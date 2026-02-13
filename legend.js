'use strict';

import * as Utils from './js/utillib.js';
import * as Config from './config.js';
import { Color } from './js/colorlib.js';
import * as MapData from './js/mapdata.js';

const settingsVersion = 1;

let settingEntries = [
    {
        label: 'Reset All',
        id: 'button_resetSettings',
        func: () =>{
            for(let entry of settingEntries){
                resetSettingEntry(entry);
            }
        }
    },
    {
        label: 'Markers',
        id: 'toggle_markers',
        saveState: true,
        state: true,
        func: state =>{
            MapData.layers.markers = state;
            MapData.view.dirty = true;
        },
        children: [
            {
                label: 'Entities',
                id: 'toggle_entities',
                saveState: true,
                state: true,
                func: state =>{
                    MapData.layers.entities = state;
                    MapData.view.dirty = true;
                },
                children:[
                    {
                        label: 'Awake',
                        id: 'toggle_entities_awake',
                        saveState: true,
                        state: true,
                        func: state => {
                            MapData.layers.entities_awake = state;
                            MapData.view.dirty = true;
                        },
                    },
                    {
                        label: 'Asleep',
                        id: 'toggle_entities_asleep',
                        saveState: true,
                        state: true,
                        func: state => {
                            MapData.layers.entities_asleep = state;
                            MapData.view.dirty = true;
                        },
                    },
                    {
                        label: 'Frozen',
                        id: 'toggle_entities_frozen',
                        saveState: true,
                        state: true,
                        func: state => {
                            MapData.layers.entities_frozen = state;
                            MapData.view.dirty = true;
                        },
                    },
                ]
            },
            {
                label: 'Components',
                id: 'toggle_components',
                saveState: true,
                state: false,
                func: state =>{
                    MapData.layers.components = state;
                    MapData.view.dirty = true;
                },
            },
        ],
    },
    {
        label: 'Occupied Chunks',
        id: 'toggle_brickedchunks',
        saveState: true,
        state: true,
        func: state => {
            MapData.layers.brickedchunks = state;
            MapData.view.dirty = true;
        },
    },
    {
        label: 'Username',
        id: 'field_username',
        saveState: true,
        state: 'Your Name Here',
        placeholder: 'Your Name Here',
    },
    {
        label: 'Owner Filter',
        id: 'field_ownerFilter',
        saveState: false,
        state: '',
        placeholder: 'Name/Regex/UUID',
        func: state => {
            let regMatch = /^\/(?<expression>.+)\/(?<flags>[dgimsuvy]*)$/.exec(state);
            if(regMatch){
                try{
                    MapData.setSearchFilter(RegExp(regMatch.groups.expression, regMatch.groups.flags));
                }catch(e){}
            }else{
                MapData.setSearchFilter(state);
            }
            MapData.view.dirty = true;
        }
    }
];

const legendKey = document.getElementById('legendKey');

export function initialize(){
    const settingsPanel = document.getElementById('settingsPanel');
    const oldSettingVersion = loadSetting('version');
    for(let thisSetting of settingEntries){
        if(oldSettingVersion != settingsVersion){
            resetSetting(thisSetting.id);
            addSettingEntry(thisSetting, settingsPanel);
            resetSettingEntry(thisSetting);
        }else{
            addSettingEntry(thisSetting, settingsPanel);
        }
    }
    saveSetting('version', settingsVersion);
    const legend = document.getElementById('legend');
    const legendContents = document.getElementById('legendContents');
    const legendButton = document.getElementById('legendButton');
    const legendArrow = legendButton.children[0];
    let legendState = true;
    let legendButtonEvent = e => {
        legendArrow.style.transform = `rotate(${legendState ? 180 : 0}deg) translateY(${legendState ? -0 : 0}px)`;
        legend.style.transform = `translateX(${legendState ? 0 : -legendContents.clientWidth}px)`;
        legendState = !legendState;
    };
    legendButton.addEventListener('click', legendButtonEvent);
    legendButtonEvent();
    if(document.body.clientWidth <= 700) legendButtonEvent();
    populateKey();
    setLastUpdateData();
};

function addSettingEntry(thisSetting, parent, indent=0){
    thisSetting.divContainer = document.createElement('div');
    thisSetting.labelElement = document.createElement('label');
    thisSetting.divContainer.appendChild(thisSetting.labelElement);

    thisSetting.settingType = thisSetting.id.split('_')[0];
    thisSetting.default = thisSetting.state;
    if(thisSetting.saveState) thisSetting.state = loadSetting(thisSetting.id, thisSetting.state);
    switch(thisSetting.settingType){
        case 'toggle':
            thisSetting.inputElement = document.createElement('input');
            thisSetting.inputElement.type = 'checkbox';
            thisSetting.inputElement.checked = thisSetting.state;

            if(thisSetting.func){
                thisSetting.inputElement.addEventListener('input', e =>{
                    thisSetting.func(e.target.checked);
                    if(thisSetting.saveState) saveSetting(thisSetting.id, e.target.checked);
                    if(thisSetting.children){
                        for(const child of thisSetting.children){
                            document.getElementById(child.id).parentElement.style.display = e.target.checked ? '' : 'none';
                        }
                    }
                });
                thisSetting.func(thisSetting.state);
            }
            break;
        case 'dropdown':
            thisSetting.inputElement = document.createElement('select');
            for(let inputEntry of thisSetting.options){
                let optionElement = document.createElement('option');
                if(typeof(inputEntry) == 'object'){
                    optionElement.value = inputEntry[0];
                    optionElement.innerHTML = inputEntry[1];
                }else{
                    optionElement.value = inputEntry;
                    optionElement.innerHTML = inputEntry;
                }
                if(inputEntry == thisSetting.state) optionElement.selected = true;
                thisSetting.inputElement.appendChild(optionElement);
            }
            if(thisSetting.func){
                thisSetting.inputElement.addEventListener('change', e =>{
                    thisSetting.func(e.target.value);
                    if(thisSetting.saveState) saveSetting(thisSetting.id, e.target.value);
                });
                thisSetting.func(thisSetting.state);
            }
            break;
        case 'slider':
            thisSetting.inputElement = document.createElement('input');
            thisSetting.inputElement.type = 'range';
            thisSetting.inputElement.min = thisSetting.min ?? 0;
            thisSetting.inputElement.max = thisSetting.max ?? 100;
            thisSetting.inputElement.step = thisSetting.step ?? 1;
            if(thisSetting.func){
                thisSetting.inputElement.addEventListener('input', e => {
                    thisSetting.func(e.target.value);
                    if(thisSetting.saveState) saveSetting(thisSetting.id, e.target.value);
                });
                thisSetting.func(thisSetting.state);
            }
            break;
        case 'field':
            thisSetting.inputElement = document.createElement('input');
            thisSetting.inputElement.type = 'text';
            thisSetting.inputElement.value = thisSetting.state;
            if(thisSetting.placeholder) thisSetting.inputElement.placeholder = thisSetting.placeholder;
            if(thisSetting.button){
                thisSetting.buttonElement = document.createElement('input');
                thisSetting.buttonElement.type = 'button';
                thisSetting.buttonElement.value = thisSetting.button;
                if(thisSetting.func){
                    thisSetting.buttonElement.addEventListener('click', e => {
                        thisSetting.func(thisSetting.inputElement.value);
                        if(thisSetting.saveState) saveSetting(thisSetting.id, thisSetting.inputElement.value);
                    });
                }
            }else if(thisSetting.func){
                thisSetting.inputElement.addEventListener('input', e => {
                    thisSetting.func(thisSetting.inputElement.value);
                });
            }
            if(thisSetting.saveState){
                thisSetting.inputElement.addEventListener('input', e => {
                    saveSetting(thisSetting.id, e.target.value);
                });
            }
            break;
        case 'button':
            thisSetting.inputElement = document.createElement('input');
            thisSetting.inputElement.type = 'button';
            thisSetting.inputElement.value = thisSetting.label;
            if(thisSetting.func){
                thisSetting.inputElement.addEventListener('click', e => {
                    thisSetting.func(0);
                });
            }
            break;
        case 'header':
            break;
        default:
            thisSetting.divContainer.remove();
            return;
    }
    parent.appendChild(thisSetting.divContainer);
    if(thisSetting.settingType != 'button'){
        thisSetting.labelElement.innerHTML = thisSetting.label;
        thisSetting.labelElement.htmlFor = thisSetting.id;
        if(thisSetting.tooltip) thisSetting.labelElement.title = thisSetting.tooltip;
    }

    if(thisSetting.settingType == 'field'){
        if(thisSetting.buttonElement){
            thisSetting.buttonElement.style.margin = `0 0.5em 0 ${indent}em`;
            thisSetting.buttonElement.style.padding = `0 0.2em`;
            thisSetting.divContainer.prepend(thisSetting.buttonElement);
        }
    }
    if(thisSetting.inputElement){
        thisSetting.inputElement.id = thisSetting.id;
        thisSetting.inputElement.style.margin = `0 0.5em 0 ${indent}em`;
        thisSetting.divContainer.prepend(thisSetting.inputElement);
    }

    if(thisSetting.children){
        for(let child of thisSetting.children){
            addSettingEntry(child, parent, indent+1);
        }
    }
}

function resetSettingEntry(entry){
    resetSetting(entry.id);
    entry.state = entry.default;
    switch(entry.settingType){
        case 'toggle':
            entry.inputElement.checked = entry.state;
            if(entry.children){
                for(const child of entry.children){
                    document.getElementById(child.id).parentElement.style.display = entry.state ? '' : 'none';
                }
            }
            break;
        case 'dropdown':
        case 'slider':
        case 'field':
            entry.inputElement.value = entry.state;
            break;
    }
    switch(entry.settingType){
        case 'toggle':
        case 'dropdown':
        case 'slider':
            if(entry.func) entry.func(entry.state);
    }
    if(entry.children){
        for(const child of entry.children){
            resetSettingEntry(child);
        }
    }
}

function saveSetting(name, value){
    //console.trace(`saving 'setting_${name}=${encodeURIComponent(value)};'`);
    if(value == null){
        resetSetting(name);
    }else{
        document.cookie = `setting_${name}=${encodeURIComponent(value)};max-age=5000000`;
    }
}

function loadSetting(name, defaultValue){
    const cookies = document.cookie.split(/\s*;\s*/);
    for(let cookie of cookies){
        if(cookie.startsWith('setting_'+name+'=')){
            let result = cookie.split('=');
            //console.log(`Loading setting_${name}=${decodeURIComponent(result[1])}`);
            if(result[1] == '') return defaultValue;
            return autocast(decodeURIComponent(result[1]));
        }
    }
    //console.log(`Loading default setting_${name}=${defaultValue}`);
    return defaultValue;
}

function resetSetting(name){
    document.cookie = `setting_${name}=;expires=${new Date(0).toUTCString()};`;
}

function autocast(value){
    if(value == 'true' || value == 'True'){
        return true;
    }else if(value == 'false' || value == 'False'){
        return false;
    }else if(!isNaN(value)){
        return Number(value);
    }else{
        return value;
    }
}

let pageLoadUpdateDate = null;
async function setLastUpdateData(){
    if(!window.location.host.includes('github')) return;
    let commits = await (await fetch(new Request('https://api.github.com/repos/PyroNicampt/DV-Community-Map/commits'))).json();
    let lastUpdateElement = document.getElementById('lastUpdate');
    if(!commits){
        lastUpdateElement.innerHTML = '<a href="https://github.com/PyroNicampt/DV-Community-Map/commits/main/" title="Could not fetch commit history">Fetch Error</a>';
        return;
    };
    let updateDate = new Date(commits[0].commit.author.date);
    lastUpdateElement.innerHTML = `<a href="https://github.com/PyroNicampt/DV-Community-Map/commits/main/" title="${updateDate.toString()}">${Utils.formattedTimeBetweenDates(new Date(), updateDate)} ${new Date() >= updateDate ? 'ago' : 'from now'}</a>`;
    document.getElementById('changelog').innerHTML = commits[0].commit.message.replaceAll(/\n+/g, '\n').replaceAll('\n','<br>');
    if(pageLoadUpdateDate == null){
        pageLoadUpdateDate = updateDate;
    }else{
        if(updateDate.valueOf() != pageLoadUpdateDate.valueOf()){
            lastUpdateElement.innerHTML += ' Reload page to see changes!';
        }
    }

    setTimeout(() => {setLastUpdateData()}, 600000);
}

function populateKey(){
    addKeyEntry('entity_awake', 'Awake Entity');
    addKeyEntry('entity_asleep', 'Sleeping Entity');
    addKeyEntry('entity_frozen', 'Frozen Entity');
    /*
    addKeyEntry('gradeArrow', 'Grade Indication')
    addKeyEntry('speed_5', 'Speed Limit');
    addKeyEntry('junction', 'Junction/Switch');
    addKeyEntry('office', 'Station Office');
    addKeyEntry('shop', 'Shop');
    addKeyEntry('service_repair', 'Repair Service');
    addKeyEntry('service_diesel', 'Diesel Refuel');
    addKeyEntry('service_charger', 'Electric Charger');
    addKeyEntry('coal', 'Coal Tower');
    addKeyEntry('water', 'Water Tower');
    addKeyEntry('landmark', 'Landmark');
    addKeyEntry('garage', 'Garage');
    addKeyEntry('demonstrator', 'Demonstrator Spawn');
    addKeyEntry('player', 'Player');*/
    //Add empty entries to make entries align right in the columns.
    /*for(let i=0; i<1; i++){
        addKeyEntry();
    }*/
}

/**
 * Add an entry to the map key.
 * @param {string} keyImageHTML
 * @param {string} keyLabel
 */
function addKeyEntry(keySprite, keyLabel){
    if(!keyLabel) keyLabel = '&nbsp;';
    let keyDiv = document.createElement('div');
    if(keySprite && Config.spriteBounds[keySprite]){
        let keyImage = document.createElement('span');
        let spriteBounds = Config.spriteBounds[keySprite];
        keyImage.classList.add('inlineSvg');
        keyImage.style.background = `url('mapSprites.svg') -${spriteBounds.x/spriteBounds.width}em -${spriteBounds.y/spriteBounds.height}em`;
        keyImage.style.backgroundSize = '1000%';
        keyDiv.appendChild(keyImage);
        keyLabel = ' '+keyLabel;
    }
    keyDiv.innerHTML += keyLabel;
    legendKey.appendChild(keyDiv);
}