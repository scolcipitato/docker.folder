let choose = [];
let selectedRegex = [];
let selected = [];
const type = new URLSearchParams(location.search).get('type');
if (type !== 'docker') {
    $('[constraint*="docker"]').hide();
}
const id = new URLSearchParams(location.search).get('id');

(async () => {
    let folders = JSON.parse(await $.get(`/plugins/docker.folder/server/read.php?type=${type}`).promise());
    if (type === 'docker') {
        choose = JSON.parse(await $.get('/plugins/docker.folder/server/read_containers.php').promise());
    } else if (type === 'vm') {
        choose = JSON.parse(await $.get('/plugins/docker.folder/server/read_vms.php').promise());
    }

    if (id) {
        const currFolder = folders[id];
        delete folders[id];

        const form = $('div.canvas > form')[0];
        form.name.value = currFolder.name;
        form.icon.value = currFolder.icon;
        form.regex.value = currFolder.regex;
        form.preview.value = currFolder.settings.preview.toString();
        form.preview_hover.checked = currFolder.settings.preview_hover;
        form.preview_update.checked = currFolder.settings.preview_update;
        form.preview_grayscale.checked = currFolder.settings.preview_grayscale;
        form.preview_webui.checked = currFolder.settings.preview_webui;
        form.preview_logs.checked = currFolder.settings.preview_logs;
        form.expand_tab.checked = currFolder.settings.expand_tab;
        form.expand_dashboard.checked = currFolder.settings.expand_dashboard;
        for (const ct of currFolder.containers) {
            const index = choose.findIndex((e) => e.Name === ct);
            if (index > -1) {
                selected.push(choose.splice(index, 1)[0]);
            }
        };
        previewChange(form.preview);
        updateRegex(form.regex);
        updateIcon(form.icon);

    }

    for (const [id, value] of Object.entries(folders)) {
        if (value.regex) {
            const regex = new RegExp(value.regex);
            for (const container of choose) {
                if (regex.test(container.Name)) {
                    value.containers.push(container.Name);
                }
            }
        }

        for (const container of value.containers) {
            const index = choose.findIndex((e) => e.Name === container);
            if (index > -1) {
                choose.splice(index, 1);
            }
        }
    }

    updateList();
})();


const updateIcon = (e) => {
    e.previousElementSibling.src = e.value;
};
const updateRegex = (e) => {
    choose = choose.concat(selectedRegex);
    selectedRegex = [];
    if (e.value) {
        const regex = new RegExp(e.value);
        for (let i = 0; i < choose.length; i++) {
            if (regex.test(choose[i].Name)) {
                selectedRegex.push(choose.splice(i, 1)[0]);
                i--;
            }
        }
    }
    updateList();
};
const previewChange = (e) => {
    $('[constraint^="preview-"]').hide();
    $(`[constraint*="preview-${e.value}"]`).show();
};

const updateList = () => {
    const table = $('.sortable > tbody');
    table.empty();
    for (const el of selected) {
        table.append($(`<tr class="item" draggable="true"><td><img src="${el.Icon}" class="img" onerror="this.src='/plugins/dynamix.docker.manager/images/question.png';">${el.Name}</td><td><input checked type="checkbox" name="containers[]" value="${el.Name}"></td></tr>`));
    }
    for (const el of choose) {
        table.append($(`<tr class="item" draggable="true"><td><img src="${el.Icon}" class="img" onerror="this.src='/plugins/dynamix.docker.manager/images/question.png';">${el.Name}</td><td><input type="checkbox" name="containers[]" value="${el.Name}"></td></tr>`));
    }
    for (const el of selectedRegex) {
        table.prepend($(`<tr class="item"><td><img src="${el.Icon}" class="img" onerror="this.src='/plugins/dynamix.docker.manager/images/question.png';">${el.Name}</td><td><input disabled type="checkbox" name="containers[]" value="${el.Name}"></td></tr>`));
    }
    $('.sortable').on('dragover', sortTable).on('dragenter', (e) => { e.preventDefault(); });

    $('.item').on('dragstart', (e) => { e.target.classList.add("dragging") }).on('dragend', (e) => { e.target.classList.remove("dragging") });
};

const sortTable = (e) => {
    e.preventDefault();

    const sib = [...$('.item:not(.dragging)')];

    const bound = e.delegateTarget.getBoundingClientRect();

    const near = sib.find(el => {
        return e.clientY - bound.top <= el.offsetTop + el.offsetHeight / 2;
    });

    $(near).before($('.dragging'));
}

const submitForm = async (e) => {
    const type = new URLSearchParams(location.search).get('type');
    const folder = {
        name: e.name.value.toString(),
        icon: e.icon.value.toString(),
        regex: e.regex.value.toString(),
        settings: {
            'preview': parseInt(e.preview.value.toString()),
            'preview_hover': e.preview_hover.checked,
            'preview_update': e.preview_update.checked,
            'preview_grayscale': e.preview_grayscale.checked,
            'preview_webui': e.preview_webui.checked,
            'preview_logs': e.preview_logs.checked,
            'expand_tab': e.expand_tab.checked,
            'expand_dashboard': e.expand_dashboard.checked,
        },
        containers: [...$('input[name*="containers"]:checked').map((i, e) => $(e).val())]
    }
    if (id) {
        await $.post('/plugins/docker.folder/server/update.php', { type: type, content: JSON.stringify(folder), id: id });
    } else {
        await $.post('/plugins/docker.folder/server/create.php', { type: type, content: JSON.stringify(folder) });
    }

    if (type === 'vm') {
        location.href = "/VMs";
    } else {
        location.href = "/Docker";
    }
    
    return false;
}