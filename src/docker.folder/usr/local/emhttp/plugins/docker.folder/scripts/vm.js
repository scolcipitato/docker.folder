const createFolders = async () => {
    const prom = await Promise.all([
        $.get('/plugins/docker.folder/server/read.php?type=vm').promise(),
        $.get('/plugins/docker.folder/server/read_order.php?type=vm').promise(),
        $.get('/plugins/docker.folder/server/read_vms_info.php').promise()
    ]);
    let folders = JSON.parse(prom[0]);
    const webUiOrder = $("#kvm_list > tr.sortable > td.vm-name > span.outer >  span.inner > a").map((i, el) => el.innerText.trim()).get();
    const unraidOrder = JSON.parse(prom[1]);
    const vmInfo = JSON.parse(prom[2]);

    const folderRegex = /^folder-/;
    let order = unraidOrder.filter(e => (webUiOrder.includes(e) || (folderRegex.test(e) && folders[e.slice(7)])));
    order = webUiOrder.filter(x => !order.includes(x)).concat(order);
    console.log('Order:', order);

    let foldersDone = {};
    let key = 0;

    while (key < order.length) {
        const container = order[key];
        if (container.substring(0, 7) === 'folder-') {
            let id = container.substring(7);

            if (folders[id]) {
                createFolder(folders[id], id, key, order, vmInfo);
                foldersDone[id] = folders[id];
                delete folders[id];
            }

        }

        key++;
    }

    for (const [id, value] of Object.entries(folders)) {
        order.unshift(`folder-${id}`);
        createFolder(value, id, 0, order, vmInfo);
        foldersDone[id] = folders[id];
        delete folders[id];
    }

    folders = foldersDone;

    for (const [id, value] of Object.entries(folders)) {
        if(value.settings.expand_tab) {
            $(`tr.folder-id-${id} > td.vm-name > span.outer > span.inner > button`).click();
        }
    }

    globalFolders = folders;
};

const folderAutostart = (el) => {
    const status = el.target.checked;
    const id = el.target.id.split('-')[1];
    const containers = $(`tr.folder-${id}-element`);
    for (const container of containers) {
        const el = $(container).children().last();
        const cstatus = el.children('.autostart')[0].checked;
        if ((status && !cstatus) || (!status && cstatus)) {
            el.children('.switch-button-background').click();
        }
    }
};

const createFolder = (folder, id, position, order, vmInfo) => {
    let started = false;
    let autostart = false;

    if (folder.regex) {
        const regex = new RegExp(folder.regex);
        folder.containers = folder.containers.concat(order.filter(el => regex.test(el)));
    }

    const fld = `<tr parent-id="${id}" class="sortable folder-id-${id} ${folder.settings.preview_hover ? 'hover' : ''}"><td class="vm-name" style="width:220px;padding:8px"><i class="fa fa-arrows-v mover orange-text"></i><span class="outer"><span id="${id}" onclick='addVMFolderContext("${id}")' class="hand"><img src="${folder.icon}" class="img" onerror='this.src="/plugins/dynamix.docker.manager/images/question.png"'></span><span class="inner"><a href="#" onclick='editFolder("${id}")'>${folder.name}</a><a style="display:none">folder-${id}</a><button onclick='dropDownButton(this,"${id}")' style="padding:6px;min-width:0;margin:0;margin-left:1em"><i class="fa fa-chevron-down" aria-hidden="true"></i></button><br><i id="load-folder-${id}" class="fa fa-square stopped red-text"></i><span class="state">stopped</span></span></span></td><td colspan="5"><div class="folder_storage" style="display:none"></div><div class="folder-preview" style="border:solid #fff 1px;border-radius:4px;height:3.5em;overflow:hidden"></div></td><td><input class="autostart" type="checkbox" id="folder-${id}-auto" style="display:none"></td></tr><tr child-id="${id}" id="name-${id}" style="display:none"><td colspan="8" style="margin:0;padding:0"></td></tr>`;

    if (position === 0) {
        $('#kvm_list > tr.sortable').eq(position).before($(fld));
    } else {
        $('#kvm_list > tr.sortable').eq(position - 1).next().after($(fld));
    }

    $(`#folder-${id}-auto`).switchButton({ labels_placement: 'right', off_label: "Off", on_label: "On", checked: false });


    let addPreview;
    switch (folder.settings.preview) {
        case 1:
            addPreview = (id) => {
                $(`tr.folder-id-${id} > td[colspan=5] > div.folder-preview`).append($(`tr.folder-id-${id} > td[colspan=5] > .folder_storage > tr > td.vm-name > span.outer`).last().clone());
            };
            break;
        case 2:
            addPreview = (id) => {
                $(`tr.folder-id-${id} > td[colspan=5] > div.folder-preview`).append($(`tr.folder-id-${id} > td[colspan=5] > .folder_storage > tr > td.vm-name > span.outer > span:not(.inner)`).last().clone());
            };
            break;
        case 3:
            addPreview = (id) => {
                $(`tr.folder-id-${id} > td[colspan=5] > div.folder-preview`).append($(`tr.folder-id-${id} > td[colspan=5] > .folder_storage > tr > td.vm-name > span.outer > span.inner`).last().clone());
            };
            break;
        default:
            addPreview = (id) => { };
            break;
    }

    let newFolder = {};

    for (const container of folder.containers) {
        const ct = vmInfo[container];
        const index = order.indexOf(container);
        if (index > -1) {
            order.splice(index, 1);
            newFolder[container] = ct.uuid
            console.log(`${newFolder[container]}(${index}) => ${id}`);
            $(`tr.folder-id-${id} > td[colspan=5] > .folder_storage`).append($('#kvm_list > tr.sortable').eq(index).addClass(`folder-${id}-element`).removeClass('sortable'));

            addPreview(id);

            const element = $(`tr.folder-id-${id} > td[colspan=5] > .folder-preview > span.outer:last`);
            let sel;

            if (folder.settings.preview_grayscale) {
                sel = element.children('span.hand').children('img.img');
                if (!sel.length) {
                    sel = element.children('img.img');
                }
                sel.css('filter', 'grayscale(100%)');
            }
        }
        started = started || ct.running;
        autostart = autostart || ct.autostart;
    }
    folder.containers = newFolder;

    $(`tr.folder-id-${id} > td[colspan=5] > div.folder-preview > span`).wrap('<div style="float: left; height: 100%; margin-left: 10px;"></div>');

    if (started) {
        $(`tr.folder-id-${id} > td.vm-name > span.outer > span.inner > i#load-folder-${id}`).attr('class', 'fa fa-play started green-text');
        $(`#docker_list > tr.folder-id-${id} > td.vm-name > span.outer > span.inner > span.state`).text('started');
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
        $(`tr.folder-id-${id} > td[colspan=5] > .folder_storage`).append($(`.folder-${id}-element`));
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
            await $.get('/plugins/docker.folder/server/delete.php?type=vm&id=' + id).promise();
            loadedFolder = false;
            setTimeout(loadlist(), 500)
        });
};

const editFolder = (id) => {
    location.href = "/VMs/Folder?type=vm&id=" + id;
};

const addVMFolderContext = (id) => {
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

let loadedFolder = false;
let globalFolders = {};

// Add the button for creating a folder
const createFolderBtn = () => { location.href = "/VMs/Folder?type=vm" };
$('<input type="button" onclick="createFolderBtn()" value="Add Folder" style="display:none">').insertAfter('table#kvm_table');

window.loadlist_original = loadlist;
window.loadlist = (x) => {
    loadedFolder = false;
    loadlist_original(x);
};

$.ajaxPrefilter((options, originalOptions, jqXHR) => {
    if (options.url === "/plugins/dynamix.vm.manager/include/UserPrefs.php") {
        const data = new URLSearchParams(options.data);
        const containers = data.get('names').split(';');
        const folderFixRegex = /^(.*?)(?=folder-)/g;
        let num = "";
        for (let index = 0; index < containers.length - 1; index++) {
            containers[index] = containers[index].replace(folderFixRegex, '');
            num += index + ';'
        }
        data.set('names', containers.join(';'));
        data.set('index', num);
        options.data = data.toString();
        $('.unhide').show();
    } else if (options.url === "/plugins/dynamix.vm.manager/include/VMMachines.php" && !loadedFolder) {
        jqXHR.promise().then(() => {
            createFolders();
            $('div.spinner.fixed').hide();
            loadedFolder = !loadedFolder
        });
    }
});