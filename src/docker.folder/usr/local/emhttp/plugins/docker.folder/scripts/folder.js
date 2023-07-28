// list of element to select
let choose = [];
// element selected by the regex string
let selectedRegex = [];
// element selected manually
let selected = [];
// docker or vm?
const type = new URLSearchParams(location.search).get('type');
//id of the folder if present
const id = new URLSearchParams(location.search).get('id');

(async () => {
    // if editing a vm hide docker related settings
    if (type !== 'docker') {
        $('[constraint*="docker"]').hide();
    }
    // get folders
    let folders = JSON.parse(await $.get(`/plugins/docker.folder/server/read.php?type=${type}`).promise());
    // get the list of element docker/vm
    if (type === 'docker') {
        choose = JSON.parse(await $.get('/plugins/docker.folder/server/read_containers.php').promise());
    } else if (type === 'vm') {
        choose = JSON.parse(await $.get('/plugins/docker.folder/server/read_vms.php').promise());
    }

    // if editing a folder and not creating one
    if (id) {
        // select the folder and delete it from the list
        const currFolder = folders[id];
        delete folders[id];

        // set the value of the form
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
        // make the ui respond to the previus changes
        previewChange(form.preview);
        updateRegex(form.regex);
        updateIcon(form.icon);
    }

    // create the *cool* unraid button for the autostart
    $('input.basic-switch').switchButton({ labels_placement: 'right', off_label: "Off", on_label: "On"});

    // iterate over the folders
    for (const [id, value] of Object.entries(folders)) {
        // match the element to the regex
        if (value.regex) {
            const regex = new RegExp(value.regex);
            for (const container of choose) {
                if (regex.test(container.Name)) {
                    value.containers.push(container.Name);
                }
            }
        }

        // remove the containers from the order
        for (const container of value.containers) {
            const index = choose.findIndex((e) => e.Name === container);
            if (index > -1) {
                choose.splice(index, 1);
            }
        }
    }

    updateList();
})();

/**
 * Update the folder icon when editing the respective field
 * @param {*} e the element
 */
const updateIcon = (e) => {
    e.previousElementSibling.src = e.value;
};

/**
 * Update the regex selection when editing the respective field
 * @param {*} e the element
 */
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

/**
 * Update the setting visibility according to the preview setting
 * @param {*} e the element
 */
const previewChange = (e) => {
    $('[constraint^="preview-"]').hide();
    $(`[constraint*="preview-${e.value}"]`).show();
    if (type !== 'docker') {
        $('[constraint*="docker"]').hide();
    }
};

/**
 * Create the element select table
 */
const updateList = () => {
    // select the table
    const table = $('.sortable > tbody');
    // empty the table
    table.empty();

    // append the selected elements
    for (const el of selected) {
        table.append($(`<tr class="item" draggable="true"><td><span style="cursor: pointer;" onclick="setIconAsContainer(this)"><img src="${el.Icon}" class="img" onerror="this.src='/plugins/dynamix.docker.manager/images/question.png';"></span>${el.Name}</td><td><input class="container-switch" checked type="checkbox" name="containers[]" value="${el.Name}" style="display: none;"></td></tr>`));
    }

    // append the rest of the elements
    for (const el of choose) {
        table.append($(`<tr class="item" draggable="true"><td><span style="cursor: pointer;" onclick="setIconAsContainer(this)"><img src="${el.Icon}" class="img" onerror="this.src='/plugins/dynamix.docker.manager/images/question.png';"></span>${el.Name}</td><td><input class="container-switch" type="checkbox" name="containers[]" value="${el.Name}" style="display: none;"></td></tr>`));
    }

    // prepend the selected regex element
    for (const el of selectedRegex) {
        table.prepend($(`<tr class="item"><td><span style="cursor: pointer;" onclick="setIconAsContainer(this)"><img src="${el.Icon}" class="img" onerror="this.src='/plugins/dynamix.docker.manager/images/question.png';"></span>${el.Name}</td><td><input class="container-switch" checked disabled type="checkbox" name="containers[]" value="${el.Name}" style="display: none;"></td></tr>`));
    }

    // create the *cool* unraid button for the autostart
    $('table.sortable > tbody > tr > td > input.container-switch').switchButton({ show_labels: false });
    $('table.sortable > tbody > tr > td > input.container-switch:disabled').parent().find('*').css('opacity', '0.5').css('cursor', 'default').off().end().end().each(function() { this.checked = !this.checked; });

    // stuff for the sort table
    $('.item').css('border-color', $('body').css('color'));

    $('.sortable').on('dragover', sortTable).on('dragenter', (e) => { e.preventDefault(); });

    $('.item').on('dragstart', (e) => { e.target.classList.add("dragging") }).on('dragend', (e) => { e.target.classList.remove("dragging") });
};

/**
 * i have no idea how this work, if it doesn't work you have to figure out yourself
 * @param {*} e who knows
 */
const sortTable = (e) => {
    e.preventDefault();

    const sib = [...$('.item:not(.dragging)')];

    const bound = e.delegateTarget.getBoundingClientRect();

    const near = sib.find(el => {
        return e.clientY - bound.top <= el.offsetTop + el.offsetHeight / 2;
    });

    $(near).before($('.dragging'));
}

/**
 * Handle sthe form submission
 * @param {*} e the form
 * @returns {bool} always false
 */
const submitForm = async (e) => {
    // this is easy, no need for a comment :)
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
    // send the data to the right endpoint
    if (id) {
        await $.post('/plugins/docker.folder/server/update.php', { type: type, content: JSON.stringify(folder), id: id });
    } else {
        await $.post('/plugins/docker.folder/server/create.php', { type: type, content: JSON.stringify(folder) });
    }

    // return to the right tab
    if (type === 'vm') {
        location.href = "/VMs";
    } else {
        location.href = "/Docker";
    }
    
    return false;
}

/**
 * Handles the button to return to the tab
 */
const cancelBtn = () => {
    if (type === 'vm') {
        location.href = "/VMs";
    } else {
        location.href = "/Docker";
    }
};

/**
 * Set the Folder icon to the clicked element icon
 * @param {*} e the element
 */
const setIconAsContainer = (e) => {
    // console.log(e);
    $('div.canvas > form')[0].icon.value = e.firstChild.src;
    $($('div.canvas > form')[0].icon).trigger('input');
};