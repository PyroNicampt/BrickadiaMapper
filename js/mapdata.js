'use strict';

import * as Vector from './vectorlib.js';
import * as Bezier from './bezierlib.js';
import * as Utils from './utillib.js';
import {Color} from './colorlib.js';
import * as Config from './../config.js';

export let markers = [];

let visibleMarkers = [];

export let testPoint = {x:0,y:0};

export let searchFilter = '';
export function setSearchFilter(filter){
    searchFilter = filter;
}

let locationData = null;
export let playerMarker = {
    type: 'player',
    position: {x:8192, y:200, z:8192},
    rotation: 0.0,
    minZoom: 0.0,
    hidden: true,
};

export let Shops = {
    Common:[]
}

export let matrix = {
    initialize: () => {
        matrix.minX = Infinity;
        matrix.minY = Infinity;
        matrix.minAlt = Infinity;
        matrix.maxX = -Infinity;
        matrix.maxY = -Infinity;
        matrix.maxAlt = -Infinity;

        for(const marker of markers){
            matrix.minX = Math.min(matrix.minX, marker.position.x);
            matrix.minY = Math.min(matrix.minY, marker.position.y);
            matrix.minAlt = Math.min(matrix.minAlt, marker.position.z);
            matrix.maxX = Math.max(matrix.maxX, marker.position.x);
            matrix.maxY = Math.max(matrix.maxY, marker.position.y);
            matrix.maxAlt = Math.max(matrix.maxAlt, marker.position.z);
        }
        if(matrix.minX == Infinity) matrix.minX = -100;
        if(matrix.minY == Infinity) matrix.minY = -100;
        if(matrix.minAlt == Infinity) matrix.minAlt = -100;
        if(matrix.maxX == -Infinity) matrix.maxX = 100;
        if(matrix.maxY == -Infinity) matrix.maxY = 100;
        if(matrix.maxAlt == -Infinity) matrix.maxAlt = 100;
        
        matrix.width = matrix.maxX-matrix.minX;
        matrix.height = matrix.maxY-matrix.minY;

        console.log(`(${matrix.minX}, ${matrix.minY}) to (${matrix.maxX}, ${matrix.maxY}). Altitude from ${matrix.minAlt} to ${matrix.maxAlt}`);
    }
};

export let view = {
    initialize: () => {
        const mapContainer = document.getElementById('mapContainer');
        let isLandscape = mapContainer.clientWidth > mapContainer.clientHeight;
        view.scale = Math.min(mapContainer.clientWidth/(matrix.width + Config.defaultMapPadding*2), mapContainer.clientHeight/(matrix.height + Config.defaultMapPadding*2));
        view.pixelRatio = window.devicePixelRatio;
        if(isLandscape){
            view.x = (mapContainer.clientWidth*0.6 - (matrix.width * 0.5 + matrix.minX)*view.scale);
            view.y = (matrix.minY - Config.defaultMapPadding) * view.scale;
        }else{
            view.x = -(matrix.minX - Config.defaultMapPadding) * view.scale;
            view.y = -(mapContainer.clientHeight*0.5 - (matrix.height * 0.5 + matrix.minY)*view.scale);
        }
        view.dirty = false;
        view.dynDirty = false;
        view.skewX = 0;
        view.skewY = 0;

        view.convertX = (x, z) => {
            return x * view.scale * view.pixelRatio + view.x * view.pixelRatio + z * view.skewX * view.pixelRatio * view.scale;
        }
        view.convertY = (y, z) => {
            return (matrix.minY+matrix.maxY-y) * view.scale * view.pixelRatio - view.y * view.pixelRatio + z * view.skewY * view.pixelRatio * view.scale;
        }

        view.unconvertX = x => {
            return (x - view.x) / view.scale;
        }
        view.unconvertY = y => {
            return -((y + view.y) / view.scale - (matrix.minY + matrix.maxY));
        }
    }
}

export let layers = {};

export function reset(){
    markers = [];
}

export function sortMarkers(){
    markers.sort(markerSortFunction);
}

function markerSortFunction(a, b){
    if(a.type != b.type){ //Different marker types
        if(a.type == 'entity') return 1;
        if(b.type == 'entity') return -1;
        if(a.type == 'component') return 1;
        if(b.type == 'component') return -1;
        
        //Chunks always render below everything.
        if(a.type == 'chunk') return -1;
        if(b.type == 'chunk') return 1;
    }else{ //Same marker type
        if(a.type == 'entity'){
            if(a.frozen != b.frozen && a.sleeping != b.sleeping){
                if(!a.frozen && !a.sleeping) return 1;
                if(!b.frozen && !b.sleeping) return -1;
                if(!a.frozen) return 1;
                if(!b.frozen) return -1;
            }
        }else if(a.type == 'component'){
            if(a.componentActive != b.componentActive) return a.componentActive - b.componentActive;
        }
    }
    return a.position.z - b.position.z;
}

export function addMarker(markerData, level = 0){
    if(markerData.type != 'dummy')
        markers.push(markerData);

    if(markerData.children){
        for(let child of markerData.children){
            markerData(child, level+(markerData.type == 'dummy' ? 0 : 1));
        }
    }
}

export let tooltipClipboard = '';

/**
 * Finds the relevant tooltip for where the cursor is (if possible)
 * Returns "" if there is none.
 * @param {Number} cursorX 
 * @param {Number} cursorY 
 * @returns {String}
 */
export function testTooltip(cursorX, cursorY){
    cursorX = view.unconvertX(cursorX);
    cursorY = view.unconvertY(cursorY);
    tooltipClipboard = '';

    let finalTooltip = '';
    let radius = 0;
    let width = 0;
    let height = 0;

    for(const marker of markers){
        if(!marker.visible) continue;
        if(marker.boundsCheck != null){
            if(marker.boundsCheck(cursorX, cursorY)){
                finalTooltip = marker.tooltip ?? finalTooltip;
                tooltipClipboard = marker.clipboard ?? tooltipClipboard;
            }
        }else if(marker.tooltipHitzone && marker.tooltipHitzone.width && marker.tooltipHitzone.height){
            width = marker.tooltipHitzone.width * 0.5/view.scale;
            height = marker.tooltipHitzone.height * 0.5/view.scale;
            if(    marker.tooltipPosition.x - cursorX + (marker.tooltipHitzone.offsetX ?? 0)/view.scale <= width
                && marker.tooltipPosition.x - cursorX + (marker.tooltipHitzone.offsetX ?? 0)/view.scale >= -width
                && marker.tooltipPosition.y - cursorY + (marker.tooltipHitzone.offsetY ?? 0)/view.scale <= height
                && marker.tooltipPosition.y - cursorY + (marker.tooltipHitzone.offsetY ?? 0)/view.scale >= -height){
                finalTooltip = marker.tooltip ?? finalTooltip;
                tooltipClipboard = marker.clipboard ?? tooltipClipboard;
            }
        }else{
            if(marker.tooltipHitzone)
                radius = (marker.tooltipHitzone.radius ?? Config.tooltipHitzone.default.radius) / view.scale;
            else
                radius = Config.tooltipHitzone.default.radius / view.scale;
            if(Math.pow(marker.tooltipPosition.x - cursorX, 2) + Math.pow(marker.tooltipPosition.y - cursorY, 2) <= radius * radius){
                finalTooltip = marker.tooltip ?? finalTooltip;
                tooltipClipboard = marker.clipboard ?? tooltipClipboard;
            }
        }
    }

    return finalTooltip;
}