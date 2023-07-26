const createFolders = async () => {
    const prom = await Promise.all([
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
    console.log(' Docker Order:', order);

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
            expandFolder(id);
        }
    }

    globalFolders.docker = folders;
};

const createFolderDocker = (folder, id, position, order, containersInfo) => {
    let upToDate = true;
    let started = false;

    if (folder.regex) {
        const regex = new RegExp(folder.regex);
        folder.containers = folder.containers.concat(order.filter(el => regex.test(el)));
    }

    const fld = `<span class="outer solid apps stopped"><span id="folder-id-${id}" onclick='addDockerFolderContext("${id}")' class="hand"><img src="${folder.icon}" class="img" onerror="this.src='/plugins/dynamix.docker.manager/images/question.png';"></span><span class="inner"><span class="">${folder.name}</span> <br><i class="fa fa-square stopped red-text"></i><span class="state">stopped</span></span><div class="folder_storage" style="display:none"></div></span>`;

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
            console.log(`Docker ${index} for ${id}`);
            $(`span#folder-id-${id}`).siblings('div.folder_storage').append($('tbody#docker_view > tr.updated > td > span.outer').eq(index).addClass(`folder-${id}-element`));
        }
        upToDate = upToDate && ct.updated == "true";
        started = started || ct.running;
        newFolder[container] = $(`span#folder-id-${id}`).siblings('div.folder_storage').children('span.outer').children('span.hand')[0].id;
    }
    folder.containers = newFolder;

    const sel = $(`span#folder-id-${id}`)

    if (!upToDate) {
        sel.next('span.inner').children().first().addClass('blue-text');
    }

    if (started) {
        sel.parent().removeClass('stopped').addClass('started');
        sel.next('span.inner').children('i').replaceWith($('<i class="fa fa-play started green-text"></i>'));
        sel.next('span.inner').children('span.state').text('started')
    }
};

const expandFolder = (id) => {
    const el = $(`span#folder-id-${id}`);
    const state = el.attr('expanded') === "true";
    console.log(id, state);
    if (state) {
        el.siblings('div.folder_storage').append($(`span.folder-${id}-element`));
        el.attr('expanded', 'false');
    } else {
        el.parent().after(el.siblings('div.folder_storage').children());
        el.attr('expanded', 'true');
    }

}

const addDockerFolderContext = (id) => {
    const exp = $(`#folder-id-${id}`).attr('expanded') === "true";
    let opts = [];
    context.settings({
        right: false,
        above: false
    });

    opts.push({
        text: exp ? 'Compress' : 'Expand',
        icon: exp ? 'fa-minus' : 'fa-plus',
        action: (e) => { e.preventDefault(); expandFolder(id); }
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


    context.attach('#folder-id-' + id, opts);
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

const editDockerFolder = (id) => {
    location.href = "/Docker/Folder?type=docker&id=" + id;
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