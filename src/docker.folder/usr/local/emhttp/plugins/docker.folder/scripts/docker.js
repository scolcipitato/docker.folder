const createFolders = async () => {
    const prom = await Promise.all([
        $.get('/plugins/docker.folder/server/read.php?type=docker').promise(),
        $.get('/plugins/docker.folder/server/read_order.php?type=docker').promise(),
        $.get('/plugins/docker.folder/server/read_containers_info.php').promise()
    ]);
    let folders = JSON.parse(prom[0]);
    const webUiOrder = $("#docker_list > tr.sortable > td.ct-name > span.outer >  span.inner > span.appname").map((i, el) => el.innerText.trim()).get();
    const unraidOrder = JSON.parse(prom[1]);
    const containersInfo = JSON.parse(prom[2]);

    const folderRegex = /^folder-/;
    let order = unraidOrder.filter(e => (webUiOrder.includes(e) || (folderRegex.test(e) && folders[e.slice(7)])));
    let newOnes = webUiOrder.filter(x => !order.includes(x));
    newOnes.push(order.shift());
    newOnes.sort();
    order = newOnes.concat(order);
    console.log('Order:', order);

    let foldersDone = {};
    let key = 0;

    while (key < order.length) {
        const container = order[key];
        if (container.substring(0, 7) === 'folder-') {
            let id = container.substring(7);

            if (folders[id]) {
                createFolder(folders[id], id, key, order, containersInfo);
                foldersDone[id] = folders[id];
                delete folders[id];
            }

        }

        key++;
    }

    for (const [id, value] of Object.entries(folders)) {
        order.unshift(`folder-${id}`);
        createFolder(value, id, 0, order, containersInfo);
        foldersDone[id] = folders[id];
        delete folders[id];
    }

    folders = foldersDone;

    for (const [id, value] of Object.entries(folders)) {
        if (value.settings.expand_tab) {
            $(`tr.folder-id-${id} > td.ct-name > span.outer > span.inner > button`).click();
        }
    }

    globalFolders = folders;
};

const folderAutostart = (el) => {
    const status = el.target.checked;
    const id = el.target.id.split('-')[1];
    const containers = $(`tr.folder-${id}-element`);
    for (const container of containers) {
        const el = $(container).children('td.advanced').next();
        const cstatus = el.children('.autostart')[0].checked;
        if ((status && !cstatus) || (!status && cstatus)) {
            el.children('.switch-button-background').click();
        }
    }
};

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

const bToMem = (b) => {
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    let index = 0;
    while (b >= 1024) {
        b /= 1024;
        index++;
    }
    return b.toFixed(2) + units[index];
};

const createFolder = (folder, id, position, order, containersInfo) => {
    let upToDate = true;
    let started = false;
    let autostart = false;

    const advanced = $.cookie('docker_listview_mode') == 'advanced';

    if (folder.regex) {
        const regex = new RegExp(folder.regex);
        folder.containers = folder.containers.concat(order.filter(el => regex.test(el)));
    }

    const fld = `<tr class="sortable folder-id-${id} ${folder.settings.preview_hover ? 'hover' : ''}"><td class="ct-name" style="width:220px;padding:8px"><i class="fa fa-arrows-v mover orange-text"></i><span class="outer"><span id="${id}" onclick="addDockerFolderContext('${id}')" class="hand"><img src="${folder.icon}" class="img" onerror='this.src="/plugins/dynamix.docker.manager/images/question.png"'></span><span class="inner"><span class="appname " style="display: none;"><a>folder-${id}</a></span><a class="exec" onclick='editFolder("${id}")'>${folder.name}</a><button onclick="dropDownButton(this, '${id}')" style="padding:6px;min-width:0;margin:0;margin-left: 1em;"><i class="fa fa-chevron-down" aria-hidden="true"></i></button><br><i id="load-folder-${id}" class="fa fa-square stopped red-text"></i><span class="state">stopped</span></span></span></td><td class="updatecolumn"><span class="green-text" style="white-space:nowrap"><i class="fa fa-check fa-fw"></i>up-to-date</span></td><td colspan="3"><div class="folder_storage" style="display:none"></div><div class="folder-preview" style="border:solid #fff 1px;border-radius:4px;height:3.5em;overflow:hidden"></div></td><td class="advanced" ${advanced ? 'style="display: table-cell;"' : ''}><span class="cpu-folder-${id}">0%</span><div class="usage-disk mm"><span id="cpu-folder-${id}" style="width:0%"></span><span></span></div><br><span class="mem-folder-${id}">0B / 0B</span></td><td><input type="checkbox" id="folder-${id}-auto" class="autostart" style="display:none"><div style="clear:left"></div></td><td></td></tr>`;

    if (position === 0) {
        $('#docker_list > tr.sortable').eq(position).before($(fld));
    } else {
        $('#docker_list > tr.sortable').eq(position - 1).after($(fld));
    }

    $(`#folder-${id}-auto`).switchButton({ labels_placement: 'right', off_label: "Off", on_label: "On", checked: false });


    let addPreview;
    switch (folder.settings.preview) {
        case 1:
            addPreview = (id) => {
                $(`tr.folder-id-${id} > td[colspan=3] > div.folder-preview`).append($(`tr.folder-id-${id} > td[colspan=3] > .folder_storage > tr > td.ct-name > span.outer`).last().clone());
            };
            break;
        case 2:
            addPreview = (id) => {
                $(`tr.folder-id-${id} > td[colspan=3] > div.folder-preview`).append($(`tr.folder-id-${id} > td[colspan=3] > .folder_storage > tr > td.ct-name > span.outer > span.hand`).last().clone());
            };
            break;
        case 3:
            addPreview = (id) => {
                $(`tr.folder-id-${id} > td[colspan=3] > div.folder-preview`).append($(`tr.folder-id-${id} > td[colspan=3] > .folder_storage > tr > td.ct-name > span.outer > span.inner`).last().clone());
            };
            break;
        default:
            addPreview = (id) => { };
            break;
    }

    let newFolder = {};

    for (const container of folder.containers) {
        const index = order.indexOf(container);
        const ct = containersInfo[container];
        if (index > -1) {
            order.splice(index, 1);
            $(`tr.folder-id-${id} > td[colspan=3] > .folder_storage`).append($('#docker_list > tr.sortable').eq(index).addClass(`folder-${id}-element`).removeClass('sortable'));
            
            addPreview(id);
            
            const element = $(`tr.folder-id-${id} > td[colspan=3] > .folder-preview > span.outer:last`);
            newFolder[container] = $(`tr.folder-id-${id} > td[colspan=3] > .folder_storage > tr:last > td.ct-name > span.outer > span.hand`)[0].id;
            console.log(`${newFolder[container]}(${index}) => ${id}`);
            
            let sel;

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
        }
        upToDate = upToDate && ct.updated == "true";
        started = started || ct.running;
        autostart = autostart || ct.autostart;
    }
    folder.containers = newFolder;

    $(`tr.folder-id-${id} > td[colspan=3] > div.folder-preview > span`).wrap('<div style="float: left; height: 100%; margin-left: 10px;"></div>');

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

    $(`#folder-${id}-auto`).on("change", folderAutostart);
};

const dropDownButton = (element, id) => {
    const state = element.getAttribute('active') === "true";
    if (state) {
        element.children[0].classList.remove('fa-chevron-up');
        element.children[0].classList.add('fa-chevron-down');
        $(`tr.folder-id-${id}`).addClass('sortable');
        $(`tr.folder-id-${id} > td[colspan=3] > .folder_storage`).append($(`.folder-${id}-element`));
        element.setAttribute('active', 'false');
    } else {
        element.children[0].classList.remove('fa-chevron-down');
        element.children[0].classList.add('fa-chevron-up');
        $(`tr.folder-id-${id}`).removeClass('sortable').removeClass('ui-sortable-handle').css('cursor', '');
        $(`tr.folder-id-${id}`).after($(`.folder-${id}-element`));
        $(`tr.folder-id-${id}`).off();
        $(`.folder-${id}-element > td > i.fa-arrows-v`).remove();
        $(`.folder-${id}-element:last`).css('border-bottom', '1px solid');
        element.setAttribute('active', 'true');
    }
};

const rmFolder = (id) => {
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

const editFolder = (id) => {
    location.href = "/Docker/Folder?type=docker&id=" + id;
};

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

$.get('/plugins/docker.folder/server/cpu.php').promise().then((data) => {
    cpus = parseInt(data);
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

let cpus = 1;
let loadedFolder = false;
let globalFolders = {};

// Add the button for creating a folder
const createFolderBtn = () => { location.href = "/Docker/Folder?type=docker" };
$('<input type="button" onclick="createFolderBtn()" value="Add Folder" style="display:none">').insertAfter('table#docker_containers');

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