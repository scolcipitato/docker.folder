const createFolders = async () => {
    // ########################################
    // ##########       DOCKER       ##########
    // ########################################

    if($('tbody#docker_view').length > 0) {

        let prom = await Promise.all([
            $.get('/plugins/docker.folder/server/read.php?type=docker').promise(),
            $.get('/plugins/docker.folder/server/read_order.php?type=docker').promise(),
            $.get('/plugins/docker.folder/server/read_containers_info.php').promise()
        ]);
        let folders = JSON.parse(prom[0]);
        let webUiOrder = $('tbody#docker_view > tr.updated > td > span.outer.apps > span.inner > span:not(".state")').map((i, el) => el.innerText.trim()).get();
        let unraidOrder = JSON.parse(prom[1]);
        const containersInfo = JSON.parse(prom[2]);
    
        const folderRegex = /^folder-/;
        let order = unraidOrder.filter(e => (webUiOrder.includes(e) || (folderRegex.test(e) && folders[e.slice(7)])));
        console.log('Docker Order:', order);
    
        let foldersDone = {};
        let key = 0;
    
        while (key < order.length) {
            const container = order[key];
            if (container.substring(0, 7) === 'folder-') {
                let id = container.substring(7);
    
                if (folders[id]) {
                    createFolderDocker(folders[id], id, key, order, containersInfo);
                    foldersDone[id] = folders[id];
                    delete folders[id];
                }
    
            }
    
            key++;
        }
    
        for (const [id, value] of Object.entries(folders)) {
            order.unshift(`folder-${id}`);
            createFolderDocker(value, id, 0, order, containersInfo);
            foldersDone[id] = folders[id];
            delete folders[id];
        }
    
        folders = foldersDone;
    
    
        if ($('input#apps').is(':checked')) {
            $('tbody#docker_view > tr.updated > td > span.outer.stopped').css('display', 'none');
        }
    
        for (const [id, value] of Object.entries(folders)) {
            if (value.settings.expand_dashboard) {
                expandFolderDcoker(id);
            }
        }
    
        globalFolders.docker = folders;

    }


    // ########################################
    // ##########         VMS        ##########
    // ########################################

    if($('tbody#vm_view').length > 0) {

        prom = await Promise.all([
            $.get('/plugins/docker.folder/server/read.php?type=vm').promise(),
            $.get('/plugins/docker.folder/server/read_order.php?type=vm').promise(),
            $.get('/plugins/docker.folder/server/read_vms_info.php').promise()
        ]);
        folders = JSON.parse(prom[0]);
        webUiOrder = $('tbody#vm_view > tr.updated > td > span.outer.vms > span.inner').clone().children().remove().end().map((i, el) => el.innerText.trim()).get();
        unraidOrder = JSON.parse(prom[1]);
        const vmInfo = JSON.parse(prom[2]);
    
        order = unraidOrder.filter(e => (webUiOrder.includes(e) || (folderRegex.test(e) && folders[e.slice(7)])));
        order = webUiOrder.filter(x => !order.includes(x)).concat(order);
        console.log('VM Order:', order);
    
        foldersDone = {};
        key = 0;
    
        while (key < order.length) {
            const container = order[key];
            if (container.substring(0, 7) === 'folder-') {
                let id = container.substring(7);
    
                if (folders[id]) {
                    createFolderVM(folders[id], id, key, order, vmInfo);
                    foldersDone[id] = folders[id];
                    delete folders[id];
                }
    
            }
    
            key++;
        }
    
        for (const [id, value] of Object.entries(folders)) {
            order.unshift(`folder-${id}`);
            createFolderVM(value, id, 0, order, vmInfo);
            foldersDone[id] = folders[id];
            delete folders[id];
        }
    
        folders = foldersDone;
    
        for (const [id, value] of Object.entries(folders)) {
            if (value.settings.expand_dashboard) {
                expandFolderVM(id);
            }
        }
    
        globalFolders.vms = folders;
        
    }
};

const createFolderDocker = (folder, id, position, order, containersInfo) => {
    let upToDate = true;
    let started = false;

    if (folder.regex) {
        const regex = new RegExp(folder.regex);
        folder.containers = folder.containers.concat(order.filter(el => regex.test(el)));
    }

    const fld = `<span class="outer solid apps stopped"><span id="folder-id-${id}" onclick='addDockerFolderContext("${id}")' class="hand docker"><img src="${folder.icon}" class="img" onerror="this.src='/plugins/dynamix.docker.manager/images/question.png';"></span><span class="inner"><span class="">${folder.name}</span><br><i class="fa fa-square stopped red-text"></i><span class="state">stopped</span></span><div class="folder_storage" style="display:none"></div></span>`;

    if (position === 0) {
        $('tbody#docker_view > tr.updated > td > span.outer').eq(position).before($(fld));
    } else {
        $('tbody#docker_view > tr.updated > td > span.outer').eq(position - 1).after($(fld));
    }

    let newFolder = {};

    for (const container of folder.containers) {
        const index = order.indexOf(container);
        const ct = containersInfo[container];
        if (index > -1) {
            order.splice(index, 1);
            const element = $(`tbody#docker_view > tr.updated > td > span.outer.apps > span#folder-id-${id}`).siblings('div.folder_storage');
            element.append($('tbody#docker_view > tr.updated > td > span.outer').eq(index).addClass(`folder-${id}-element`));
            newFolder[container] = element.children('span.outer').children('span.hand').last()[0].id;
            console.log(`Docker ${newFolder[container]}(${index}) => ${id}`);
        }
        upToDate = upToDate && ct.updated == "true";
        started = started || ct.running;
    }
    folder.containers = newFolder;

    const sel = $(`tbody#docker_view > tr.updated > td > span.outer.apps > span#folder-id-${id}`)

    if (!upToDate) {
        sel.next('span.inner').children().first().addClass('blue-text');
    }

    if (started) {
        sel.parent().removeClass('stopped').addClass('started');
        sel.next('span.inner').children('i').replaceWith($('<i class="fa fa-play started green-text"></i>'));
        sel.next('span.inner').children('span.state').text('started')
    }
};

const createFolderVM = (folder, id, position, order, vmInfo) => {
    let started = false;

    if (folder.regex) {
        const regex = new RegExp(folder.regex);
        folder.containers = folder.containers.concat(order.filter(el => regex.test(el)));
    }

    const fld = `<span class="outer solid vms stopped"><span id="folder-id-${id}" onclick='addVMFolderContext("${id}")' class="hand vm"><img src="${folder.icon}" class="img" onerror='this.src="/plugins/dynamix.docker.manager/images/question.png"'></span><span class="inner">${folder.name}<br><i class="fa fa-square stopped red-text"></i><span class="state">stopped</span></span><div class="folder_storage" style="display:none"></div></span>`;

    if (position === 0) {
        $('tbody#vm_view > tr.updated > td > span.outer').eq(position).before($(fld));
    } else {
        $('tbody#vm_view > tr.updated > td > span.outer').eq(position - 1).after($(fld));
    }

    let newFolder = {};

    for (const container of folder.containers) {
        const index = order.indexOf(container);
        const ct = vmInfo[container];
        if (index > -1) {
            order.splice(index, 1);
            newFolder[container] = ct.uuid;
            console.log(`VM ${newFolder[container]}(${index}) => ${id}`);
            const element = $(`tbody#vm_view > tr.updated > td > span.outer.vms > span#folder-id-${id}`).siblings('div.folder_storage');
            element.append($('tbody#vm_view > tr.updated > td > span.outer').eq(index).addClass(`folder-${id}-element`));
        }
        started = started || ct.running;
    }
    folder.containers = newFolder;

    const sel = $(`tbody#vm_view > tr.updated > td > span.outer.vms > span#folder-id-${id}`)

    if (started) {
        sel.parent().removeClass('stopped').addClass('started');
        sel.next('span.inner').children('i').replaceWith($('<i class="fa fa-play started green-text"></i>'));
        sel.next('span.inner').children('span.state').text('started')
    }
};

const expandFolderDcoker = (id) => {
    const el = $(`tbody#docker_view > tr.updated > td > span.outer.apps > span#folder-id-${id}`);
    const state = el.attr('expanded') === "true";
    if (state) {
        el.siblings('div.folder_storage').append($(`tbody#docker_view > tr.updated > td > span.outer.apps > span.folder-${id}-element`));
        el.attr('expanded', 'false');
    } else {
        el.parent().after(el.siblings('div.folder_storage').children());
        el.attr('expanded', 'true');
    }

};

const expandFolderVM = (id) => {
    const el = $(`tbody#vm_view > tr.updated > td > span.outer.vms > span#folder-id-${id}`);
    const state = el.attr('expanded') === "true";
    if (state) {
        el.siblings('div.folder_storage').append($(`tbody#vm_view > tr.updated > td > span.outer.vms.folder-${id}-element`));
        el.attr('expanded', 'false');
    } else {
        el.parent().after(el.siblings('div.folder_storage').children());
        el.attr('expanded', 'true');
    }

};

const addDockerFolderContext = (id) => {
    const exp = $(`tbody#docker_view > tr.updated > td > span.outer.apps > #folder-id-${id}`).attr('expanded') === "true";
    let opts = [];
    context.settings({
        right: false,
        above: false
    });

    opts.push({
        text: exp ? 'Compress' : 'Expand',
        icon: exp ? 'fa-minus' : 'fa-plus',
        action: (e) => { e.preventDefault(); expandFolderDcoker(id); }
    });
    opts.push({
        divider: true
    });

    opts.push({
        text: 'Edit',
        icon: 'fa-wrench',
        action: (e) => { e.preventDefault(); editDockerFolder(id); }
    });

    opts.push({
        divider: true
    });

    opts.push({
        text: 'Remove',
        icon: 'fa-trash',
        action: (e) => { e.preventDefault(); rmDockerFolder(id); }
    });


    context.attach(`#folder-id-${id}`, opts);
};

const addVMFolderContext = (id) => {
    const exp = $(`tbody#vm_view > tr.updated > td > span.outer.vms > #folder-id-${id}`).attr('expanded') === "true";
    let opts = [];
    context.settings({
        right: false,
        above: false
    });

    opts.push({
        text: exp ? 'Compress' : 'Expand',
        icon: exp ? 'fa-minus' : 'fa-plus',
        action: (e) => { e.preventDefault(); expandFolderVM(id); }
    });
    opts.push({
        divider: true
    });

    opts.push({
        text: 'Edit',
        icon: 'fa-wrench',
        action: (e) => { e.preventDefault(); editVMFolder(id); }
    });

    opts.push({
        divider: true
    });

    opts.push({
        text: 'Remove',
        icon: 'fa-trash',
        action: (e) => { e.preventDefault(); rmVMFolder(id); }
    });


    context.attach(`#folder-id-${id}`, opts);
};

const rmDockerFolder = (id) => {
    swal({
        title: 'Are you sure?',
        text: `Remove folder: ${globalFolders.docker[id].name}`,
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
            loadedFolder = false;
            setTimeout(loadlist(), 500)
        });
};

const rmVMFolder = (id) => {
    swal({
        title: 'Are you sure?',
        text: `Remove folder: ${globalFolders.vm[id].name}`,
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

const editDockerFolder = (id) => {
    location.href = "/Docker/Folder?type=docker&id=" + id;
};

const editVMFolder = (id) => {
    location.href = "/VMs/Folder?type=vm&id=" + id;
};

let loadedFolder = false;
let globalFolders = {};

window.loadlist_original = loadlist;
window.loadlist = (x) => {
    loadedFolder = false;
    loadlist_original(x);
};

$.ajaxPrefilter((options, originalOptions, jqXHR) => {
    if (options.url === "/webGui/include/DashboardApps.php" && !loadedFolder) {
        jqXHR.promise().then(() => {
            createFolders();
            $('div.spinner.fixed').hide();
            loadedFolder = !loadedFolder
        });
    }
});