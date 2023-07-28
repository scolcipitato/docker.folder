/**
 * Handles the creation of all folders
 */
const createFolders = async () => {
    const prom = await Promise.all([
        // Get the folders
        $.get('/plugins/docker.folder/server/read.php?type=docker').promise(),
        // Get the order as unraid sees it
        $.get('/plugins/docker.folder/server/read_order.php?type=docker').promise(),
        // Get the info on containers, needed for autostart, update and started
        $.get('/plugins/docker.folder/server/read_containers_info.php').promise()
    ]);
    // Get the list of container on the webui
    const webUiOrder = $("#docker_list > tr.sortable > td.ct-name > span.outer >  span.inner > span.appname").map((i, el) => el.innerText.trim()).get();
    // Parse the results
    let folders = JSON.parse(prom[0]);
    const unraidOrder = JSON.parse(prom[1]);
    const containersInfo = JSON.parse(prom[2]);



    // Filter the order to make sure no 'ghost' container are present in the final order, unraid don't remove deleted container from the order
    let order = unraidOrder.filter(e => (webUiOrder.includes(e) || (folderRegex.test(e) && folders[e.slice(7)])));
    // Filter the webui order to get the container that aren't in the order, this happen when a new container is created
    let newOnes = webUiOrder.filter(x => !order.includes(x));
    // This seems strange but unraid keep the first element in the order and insert element around it
    newOnes.push(order.shift());
    // Sort the container to mirror unraid behavior
    newOnes.sort();
    // Finally add the new contaners to the final order
    order = newOnes.concat(order);
    
    // debug mode, download the debug json file
    if(folderDebugMode) {
        let element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify({
            veriosn: await $.get('/plugins/docker.folder/server/version.php').promise(),
            webUiOrder,
            folders,
            unraidOrder,
            containersInfo,
            newOnes,
            order
        })));
        element.setAttribute('download', 'debug-DOCKER.json');
    
        element.style.display = 'none';
        document.body.appendChild(element);
    
        element.click();
    
        document.body.removeChild(element);
        console.log('Order:', [...order]);
    }

    let foldersDone = {};

    // Draw the folders in the order
    for (let key = 0; key < order.length; key++) {
        const container = order[key];
        if (container && folderRegex.test(container)) {
            let id = container.replace(folderRegex, '');
            if (folders[id]) {
                createFolder(folders[id], id, key, order, containersInfo, Object.keys(foldersDone));
                // Move the folder to the done object and delete it from the undone one
                foldersDone[id] = folders[id];
                delete folders[id];
            }
        }
    }

    // Draw the foldes outside of the order
    for (const [id, value] of Object.entries(folders)) {
        // Add the folder on top of the array
        order.unshift(`folder-${id}`);
        createFolder(value, id, 0, order, containersInfo, Object.keys(foldersDone));
        // Move the folder to the done object and delete it from the undone one
        foldersDone[id] = folders[id];
        delete folders[id];
    }

    // Expand folders that are set to be expanded by default, this is here because is easier to work with all compressed folder when creating them
    for (const [id, value] of Object.entries(foldersDone)) {
        if (value.settings.expand_tab) {
            dropDownButton(id);
        }
    }

    // Assing the folder done to the global object
    globalFolders = foldersDone;
    
    folderDebugMode = false;
};

/**
 * Handles the creation of one folder
 * @param {object} folder the folder
 * @param {string} id if of the folder
 * @param {int} position position to inset the folder
 * @param {Array<string>} order order of containers
 * @param {object} containersInfo info of the containers
 * @param {Array<string>} foldersDone folders that are done
 */
const createFolder = (folder, id, position, order, containersInfo, foldersDone) => {
    // default varibles
    let upToDate = true;
    let started = false;
    let autostart = false;

    // Get if the advanced view is enabled
    const advanced = $.cookie('docker_listview_mode') == 'advanced';

    // If regex is present searches all containers for a match and put them inside the folder containers
    if (folder.regex) {
        const regex = new RegExp(folder.regex);
        folder.containers = folder.containers.concat(order.filter(el => regex.test(el)));
    }

    // the HTML template for the folder
    const fld = `<tr class="sortable folder-id-${id} ${folder.settings.preview_hover ? 'hover' : ''}"><td class="ct-name" style="width:220px;padding:8px"><i class="fa fa-arrows-v mover orange-text"></i><span class="outer"><span id="${id}" onclick="addDockerFolderContext('${id}')" class="hand"><img src="${folder.icon}" class="img" onerror='this.src="/plugins/dynamix.docker.manager/images/question.png"'></span><span class="inner"><span class="appname " style="display: none;"><a>folder-${id}</a></span><a class="exec" onclick='editFolder("${id}")'>${folder.name}</a><br><i id="load-folder-${id}" class="fa fa-square stopped red-text"></i><span class="state">stopped</span></span></span><button class="dropDown-${id}" onclick="dropDownButton('${id}')" style="padding:6px;min-width:0;margin:0;margin-left: 1em;float:right;"><i class="fa fa-chevron-down" aria-hidden="true"></i></button></td><td class="updatecolumn"><span class="green-text" style="white-space:nowrap"><i class="fa fa-check fa-fw"></i>up-to-date</span></td><td colspan="3"><div class="folder_storage" style="display:none"></div><div class="folder-preview" style="border:solid ${$('body').css('color')} 1px;border-radius:4px;height:3.5em;overflow:hidden"></div></td><td class="advanced" ${advanced ? 'style="display: table-cell;"' : ''}><span class="cpu-folder-${id}">0%</span><div class="usage-disk mm"><span id="cpu-folder-${id}" style="width:0%"></span><span></span></div><br><span class="mem-folder-${id}">0B / 0B</span></td><td><input type="checkbox" id="folder-${id}-auto" class="autostart" style="display:none"><div style="clear:left"></div></td><td></td></tr>`;

    // insertion at position of the folder
    if (position === 0) {
        $('#docker_list > tr.sortable').eq(position).before($(fld));
    } else {
        $('#docker_list > tr.sortable').eq(position - 1).after($(fld));
    }

    // create the *cool* unraid button for the autostart
    $(`#folder-${id}-auto`).switchButton({ labels_placement: 'right', off_label: "Off", on_label: "On", checked: false });


    // select the preview function to use
    let addPreview;
    switch (folder.settings.preview) {
        case 1:
            addPreview = (id) => {
                $(`tr.folder-id-${id} > td[colspan=3] > div.folder-preview`).append($(`tr.folder-id-${id} > td[colspan=3] > .folder_storage > tr > td.ct-name > span.outer:last`).clone());
            };
            break;
        case 2:
            addPreview = (id) => {
                $(`tr.folder-id-${id} > td[colspan=3] > div.folder-preview`).append($(`tr.folder-id-${id} > td[colspan=3] > .folder_storage > tr > td.ct-name > span.outer > span.hand:last`).clone());
            };
            break;
        case 3:
            addPreview = (id) => {
                $(`tr.folder-id-${id} > td[colspan=3] > div.folder-preview`).append($(`tr.folder-id-${id} > td[colspan=3] > .folder_storage > tr > td.ct-name > span.outer > span.inner:last`).clone());
            };
            break;
        default:
            addPreview = (id) => { };
            break;
    }

    // new folder is needed for not altering the old containers
    let newFolder = {};

    // foldersDone is and array of only ids there is the need to add the 'folder-' in front
    foldersDone = foldersDone.map(e => 'folder-'+e);

    // remove the undone folders from the order, needed because they can cause an offset when grabbing the containers
    const cutomOrder = order.filter((e) => {
        return e && (foldersDone.includes(e) || !(folderRegex.test(e) && e !== `folder-${id}`));
    });

    // loop over the containers
    for (const container of folder.containers) {
        // get both index, tis is needed for removing from the orders later
        const index = cutomOrder.indexOf(container);
        const offsetIndex = order.indexOf(container);
        
        if (index > -1) {
            // remove the containers from the order
            cutomOrder.splice(index, 1);
            order.splice(offsetIndex, 1);

            // grab the container and put it onto the storage
            $(`tr.folder-id-${id} > td[colspan=3] > .folder_storage`).append($('#docker_list > tr.sortable').eq(index).addClass(`folder-${id}-element`).removeClass('sortable'));
            
            addPreview(id);

            // add the id to the container name 
            newFolder[container] = $(`tr.folder-id-${id} > td[colspan=3] > .folder_storage > tr:last > td.ct-name > span.outer > span.hand`)[0].id;

            if(folderDebugMode) {
                console.log(`${newFolder[container]}(${offsetIndex}, ${index}) => ${id}`);
            }

            // element to set the preview options
            const element = $(`tr.folder-id-${id} > td[colspan=3] > .folder-preview > span.outer:last`);

            //temp var
            let sel;
            const ct = containersInfo[container];

            //set the preview option

            if (folder.settings.preview_grayscale) {
                sel = element.children('span.hand').children('img.img');
                if (!sel.length) {
                    sel = element.children('img.img');
                }
                sel.css('filter', 'grayscale(100%)');
            }

            if (folder.settings.preview_update && ct.updated != "true") {
                sel = element.children('span.inner').children('span.blue-text');
                if (!sel.length) {
                    sel = element.children('span.blue-text');
                }
                sel.removeClass('blue-text').addClass('orange-text');
                sel.children('a.exec').addClass('orange-text');
            }

            if (folder.settings.preview_webui && ct.url) {
                sel = element.children('span.inner');
                if (!sel.length) {
                    sel = element;
                }
                sel.append($(`<span><a href="${ct.url}" target="_blank"><i class="fa fa-globe" aria-hidden="true"></i></a></span>`));
            }

            if (folder.settings.preview_logs) {
                sel = element.children('span.inner');
                if (!sel.length) {
                    sel = element;
                }
                sel.append($(`<span><a href="#" onclick="openTerminal('docker', '${container}', '.log')"><i class="fa fa-bars" aria-hidden="true"></i></a></span>`));
            }

            // set the status of the folder
            upToDate = upToDate && ct.updated == "true";
            started = started || ct.running;
            autostart = autostart || ct.autostart;
        }
    }

    // replace the old containers array with the newFolder object
    folder.containers = newFolder;

    // wrap the preview with a div
    $(`tr.folder-id-${id} > td[colspan=3] > div.folder-preview > span`).wrap('<div style="float: left; height: 100%; margin-left: 10px; margin-top: 5px;"></div>');

    //set tehe status of a folder

    if (!upToDate) {
        const sel = $(`tr.folder-id-${id} > td.updatecolumn`);
        sel.empty();
        sel.append($('<span class="orange-text" style="white-space:nowrap;"><i class="fa fa-flash fa-fw"></i> update ready</span>'));
    }

    if (started) {
        $(`#docker_list > tr.folder-id-${id} > td.ct-name > span.outer > span.inner > i#load-folder-${id}`).attr('class', 'fa fa-play started green-text');
        $(`#docker_list > tr.folder-id-${id} > td.ct-name > span.outer > span.inner > span.state`).text('started');
    }

    if (autostart) {
        $(`#folder-${id}-auto`).next().click();
    }

    // add the function to handle the change on the autostart checkbox, this is here because of the if before, i don't want to handle the change i triggered before
    $(`#folder-${id}-auto`).on("change", folderAutostart);
};

/**
 * Hanled the click of the autostart button and changes the container to reflect the status of the folder
 * @param {*} el element passed by the event caller
 */
const folderAutostart = (el) => {
    const status = el.target.checked;
    // The id is needded to get the containers, the checkbox has a id folder-${id}-auto, so split and take the second element
    const id = el.target.id.split('-')[1];
    const containers = $(`.folder-${id}-element`);
    for (const container of containers) {
        // Select the td with the switch inside
        const el = $(container).children('td.advanced').next();

        // Get the status of the container
        const cstatus = el.children('.autostart')[0].checked;
        if ((status && !cstatus) || (!status && cstatus)) {
            el.children('.switch-button-background').click();
        }
    }
};

/**
 * Handle the dropdown expand button of folders
 * @param {string} id the id of the folder
 */
const dropDownButton = (id) => {
    const element = $(`.dropDown-${id}`);
    const state = element.attr('active') === "true";
    if (state) {
        element.children().removeClass('fa-chevron-up').addClass('fa-chevron-down');
        $(`tr.folder-id-${id}`).addClass('sortable');
        $(`tr.folder-id-${id} > td[colspan=3] > .folder_storage`).append($(`.folder-${id}-element`));
        element.attr('active', 'false');
    } else {
        element.children().removeClass('fa-chevron-down').addClass('fa-chevron-up');
        $(`tr.folder-id-${id}`).removeClass('sortable').removeClass('ui-sortable-handle').off().css('cursor', '');
        $(`tr.folder-id-${id}`).after($(`.folder-${id}-element`));
        $(`.folder-${id}-element > td > i.fa-arrows-v`).remove();
        $(`.folder-${id}-element:last`).css('border-bottom', '1px solid');
        element.attr('active', 'true');
    }
};

/**
 * Removie the folder
 * @param {string} id the id of the folder
 */
const rmFolder = (id) => {
    // Ask for a confirmation
    swal({
        title: 'Are you sure?',
        text: `Remove folder: ${globalFolders[id].name}`,
        type: 'warning',
        html: true,
        showCancelButton: true,
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel',
        showLoaderOnConfirm: true
    },
    async (c) => {
        if (!c) { setTimeout(loadlist); return; }
        $('div.spinner.fixed').show('slow');
        await $.get('/plugins/docker.folder/server/delete.php?type=docker&id=' + id).promise();
        setTimeout(loadlist(), 500)
    });
};

/**
 * Redirect to the page to edit the folder
 * @param {string} id the id of the folder
 */
const editFolder = (id) => {
    location.href = "/Docker/Folder?type=docker&id=" + id;
};

/**
 * Atach the menu when clicking the folder icon
 * @param {string} id the id of the folder
 */
const addDockerFolderContext = (id) => {
    let opts = [];
    context.settings({
        right: false,
        above: false
    });

    opts.push({
        text: 'Edit',
        icon: 'fa-wrench',
        action: (e) => { e.preventDefault(); editFolder(id); }
    });

    opts.push({
        divider: true
    });

    opts.push({
        text: 'Remove',
        icon: 'fa-trash',
        action: (e) => { e.preventDefault(); rmFolder(id); }
    });

    context.attach('#' + id, opts);
};

// Patching the original function to make sure the containers are rendered before insering the folder
window.listview_original = listview;
window.listview = () => {
    listview_original();
    if (!loadedFolder) {
        createFolders();
        loadedFolder = true;
    }
};

window.loadlist_original = loadlist;
window.loadlist = () => {
    loadedFolder = false;
    loadlist_original();
};

// Get the number of CPU, nneded for a right display of the load
$.get('/plugins/docker.folder/server/cpu.php').promise().then((data) => {
    cpus = parseInt(data);
    // Attach to the scoket and process the data
    dockerload.addEventListener('message', (e) => {
        let load = {};
        e.split('\n').forEach((e) => {
            const exp = e.split(';');
            load[exp[0]] = {
                cpu: exp[1],
                mem: exp[2].split(' / ')
            };
        });
        for (const [id, value] of Object.entries(globalFolders)) {
            let loadCpu = 0;
            let totalMem = 0;
            let loadMem = 0;
            for (const [cid, cvalue] of Object.entries(value.containers)) {
                const curLoad = load[cvalue] || { cpu: '0.00%', mem: ['0B', '0B'] };
                loadCpu += parseFloat(curLoad.cpu.replace('%', ''))/cpus;
                loadMem += memToB(curLoad.mem[0]);
                let tempTotalMem = memToB(curLoad.mem[1]);
                totalMem = (tempTotalMem > totalMem) ? tempTotalMem : totalMem;
            }
            $(`span.mem-folder-${id}`).text(`${bToMem(loadMem)} / ${bToMem(totalMem)}`);
            $(`span.cpu-folder-${id}`).text(`${loadCpu.toFixed(2)}%`);
            $(`span#cpu-folder-${id}`).css('width', `${loadCpu.toFixed(2)}%`)
        }
    });
});

/**
 * Convert memory unit to Bytes
 * @param {string} mem the unraid memory notation
 * @returns {number} number of bytes
 */
const memToB = (mem) => {
    const unit = mem.match(/[a-zA-Z]/g).join('');
    mem = parseFloat(mem.replace(unit, ''));
    let loadMem = 0;
    switch (unit) {
        case 'KiB':
            loadMem += (2 ** 10) * mem;
            break;
        case 'MiB':
            loadMem = (2 ** 20) * mem;
            break;
        case 'GiB':
            loadMem = (2 ** 30) * mem;
            break;
        case 'TiB':
            loadMem = (2 ** 40) * mem;
            break;
        case 'PiB':
            loadMem = (2 ** 50) * mem;
            break;
        case 'EiB':
            loadMem = (2 ** 60) * mem;
            break;
        case 'ZiB':
            loadMem = (2 ** 70) * mem;
            break;
        case 'YiB':
            loadMem = (2 ** 80) * mem;
            break;
        default:
            loadMem = 1 * mem;
            break;
    }
    return loadMem;
};

/**
 * Convert Bytes to memory units
 * @param {number} b the number of bytes
 * @returns {string} a string with the right notation and right unit
 */
const bToMem = (b) => {
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    let index = 0;
    while (b >= 1024) {
        b /= 1024;
        index++;
    }
    return b.toFixed(2) + units[index];
};

// Global variables
let cpus = 1;
let loadedFolder = false;
let globalFolders = {};
const folderRegex = /^folder-/;
let folderDebugMode = false;
let folderDebugModeWindow = [];

// Add the button for creating a folder
const createFolderBtn = () => { location.href = "/Docker/Folder?type=docker" };
$('<input type="button" onclick="createFolderBtn()" value="Add Folder" style="display:none">').insertAfter('table#docker_containers');

// This is needed because unraid don't like the folder and the number are set incorrectly, this intercept the request and change the numbers to make the order appear right, this is important for the autostart and to draw the folders
$.ajaxPrefilter((options, originalOptions, jqXHR) => {
    if (options.url === "/plugins/dynamix.docker.manager/include/UserPrefs.php") {
        const data = new URLSearchParams(options.data);
        const containers = data.get('names').split(';');
        let num = "";
        for (let index = 0; index < containers.length - 1; index++) {
            num += index + ';'
        }
        data.set('index', num);
        options.data = data.toString();
    }
});

// activate debug mode
addEventListener("keydown", (e) => {
    if (e.isComposing || e.key.length !== 1) { // letter X FOR TESTING
        return;
    }
    folderDebugModeWindow.push(e.key);
    if(folderDebugModeWindow.length > 5) {
        folderDebugModeWindow.shift();
    }
    if(folderDebugModeWindow.join('').toLowerCase() === "debug") {
        folderDebugMode = true;
        loadlist();
    }
})