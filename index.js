'use strict';

import * as Vector from './js/vectorlib.js';
import * as Bezier from './js/bezierlib.js';
import * as Utils from './js/utillib.js';
import {Color} from './js/colorlib.js';
import * as Config from './config.js';
import * as MapData from './js/mapdata.js';
import * as Legend from './legend.js';

const mapContainer = document.getElementById('mapContainer');
const mapCanvas = document.getElementById('mapCanvas');
const dynCanvas = document.getElementById('dynCanvas');
/** The main map drawing context.
 * @type {CanvasRenderingContext2D} */
const mapctx = mapCanvas.getContext('2d');
/** The dynamic map drawing context.
 * @type {CanvasRenderingContext2D} */
const dynctx = dynCanvas.getContext('2d');
const mapSprites = document.getElementById('mapSprites');
const mapTerrain = document.getElementById('mapTerrain');
const zoomLevelDisplay = document.getElementById('zoomLevelDisplay');
const markerCountDisplay = document.getElementById('markerCountDisplay');
const warningPanel = document.getElementById('warningPanel');

let isNavigating = false;

document.addEventListener('DOMContentLoaded', async () => {
    //await loadMapperData('data/mapperdata.json');
    MapData.sortMarkers();

    MapData.matrix.initialize();
    MapData.view.initialize();
    redrawMap();
    mapNavigationSetup();
    Legend.initialize();
    tooltipSetup();

    document.ondragover = document.ondragenter = event => {
        event.preventDefault();
    }
    document.ondrop = async event => {
        event.preventDefault();
        MapData.reset();
        warningPanel.innerHTML = '';
        warningPanel.style.display = 'none';
        for(let item of event.dataTransfer.items){
            if(item.kind == 'file' && (item.type === 'application/json' || item.type === 'text/json')){
                await loadMapperData(JSON.parse(await(item.getAsFile().text())));
            }
        }
        MapData.sortMarkers();
        MapData.matrix.initialize();
        MapData.view.initialize();
        redrawMap();
    }
});

window.addEventListener('resize', () => {MapData.view.dirty = true});

/** Handling for the map scrolling and zooming */
function mapNavigationSetup(){
    let touchCache = [];
    let touchCount = 0;
    let pinchDistance = null;
    let previousScale = null;
    const touchDownHandler = e => {
        if(e.button != 0) return;
        if(touchCache.length == 0){
            document.addEventListener('pointermove', touchMoveHandler);

            document.addEventListener('pointerup', touchUpHandler);
            document.addEventListener('pointercancel', touchUpHandler);
            //document.addEventListener('pointerout', touchUpHandler);
            document.addEventListener('pointerleave', touchUpHandler);
        }
        touchCache[e.pointerId] = {x:e.clientX, y:e.clientY};
        touchCount++;
        if(touchCount == 2){
            pinchDistance = getTouchDistance();
            previousScale = MapData.view.scale;
        }
        mapContainer.style.cursor = 'grabbing';
    }
    const touchMoveHandler = e => {
        if(!touchCache[e.pointerId]){
            touchCache = [];
            return;
        }
        if(touchCount == 1){
            MapData.view.x += e.clientX - touchCache[e.pointerId].x;
            MapData.view.y -= e.clientY - touchCache[e.pointerId].y;
        }else if(touchCount == 2){
            getTouchAverage();
            zoomAtPosition(touchCenter_x, touchCenter_y, (previousScale * getTouchDistance()/pinchDistance)/MapData.view.scale);
        }else{
            touchCache = [];
            MapData.view.dirty = true;
            return;
        }
        isNavigating = true;
        touchCache[e.pointerId].x = e.clientX;
        touchCache[e.pointerId].y = e.clientY;
        MapData.view.dirty = true;
    }
    const touchUpHandler = e => {
        if(!touchCache[e.pointerId]) return;
        touchCache[e.pointerId] = null;
        touchCount--;
        if(touchCount <= 0){
            mapContainer.style.cursor = '';
        }
    }
    const scrollHandler = e => {
        if(e.deltaY != 0) zoomAtPosition(e.clientX, e.clientY, e.deltaY > 0 ? 1/Config.scrollZoomFactor : Config.scrollZoomFactor);
    }
    const navButtonInput = navType => {
        const centerX = mapContainer.offsetWidth / 2;
        const centerY = mapContainer.offsetHeight / 2;
        switch(navType){
            case 'zoomIn':
                zoomAtPosition(centerX, centerY, Config.buttonZoomFactor);
                break;
            case 'zoomOut':
                zoomAtPosition(centerX, centerY, 1/Config.buttonZoomFactor);
                break;
        }
    }
    
    const navUpdate = ts => {
        if(ts && MapData.view.dirty){
            redrawMap();
        }
        requestAnimationFrame(navUpdate);
    }

    let touchDist_aX = 0;
    let touchDist_aY = 0;
    let touchDist_counter = 0;
    const getTouchDistance = () => {
        touchDist_counter = 0;
        touchDist_aX = 0;
        touchDist_aY = 0;
        for(let touch of touchCache){
            if(touchDist_counter == 0){
                touchDist_aX += touch.x;
                touchDist_aY += touch.y;
            }else{
                touchDist_aX -= touch.x;
                touchDist_aY -= touch.y;
                break;
            }
            touchDist_counter++;
        }
        return Math.sqrt(touchDist_aX*touchDist_aX + touchDist_aY*touchDist_aY);
    };

    let touchCenter_x = 0;
    let touchCenter_y = 0;
    let touchCenter_count = 0;
    const getTouchAverage = () => {
        touchCenter_x = 0;
        touchCenter_y = 0;
        touchCenter_count = 0;
        for(let touch of touchCache){
            touchCenter_x += touch.x;
            touchCenter_y += touch.y;
            touchCenter_count++;
        }
        touchCenter_x /= touchCenter_count;
        touchCenter_y /= touchCenter_count;
    }

    let zoomCursorLocal_x = 0;
    let zoomCursorLocal_y = 0;
    const zoomAtPosition = (x, y, scaleFactor) => {
        if(MapData.view.scale * scaleFactor > Config.maxZoomLevel || MapData.view.scale * scaleFactor < Config.minZoomLevel){
            MapData.view.dirty = false;
            return;
        }
        MapData.view.x = x - scaleFactor * (x - MapData.view.x);
        MapData.view.y = -y - scaleFactor * (-y - MapData.view.y);
        MapData.view.scale *= scaleFactor;
        MapData.view.dirty = true;
    }
	
    mapContainer.addEventListener('pointerdown', touchDownHandler);
    mapContainer.addEventListener('wheel', scrollHandler);

    document.getElementById('navZoomIn').addEventListener('click', e => {navButtonInput('zoomIn');});
    document.getElementById('navZoomOut').addEventListener('click', e => {navButtonInput('zoomOut');});
    navUpdate();
}

function tooltipSetup(){
    const tooltip = document.getElementById('tooltip');
    const cursorCoordDisplay = document.getElementById('cursorCoordDisplay');
    let tooltipX = 0;
    let tooltipY = 0;
    let tooltipDirty = false;
    let removeTooltip = false;

    mapContainer.addEventListener('mousemove', event => {
        tooltipX = event.clientX;
        tooltipY = event.clientY;
        removeTooltip = false;
        tooltipDirty = true;
    });
    mapContainer.addEventListener('mouseleave', event => {
        removeTooltip = true;
        tooltipDirty = true;
    });

    document.addEventListener('copy', event => {
        if(MapData.tooltipClipboard){
            if(typeof(MapData.tooltipClipboard) == 'function'){
                event.clipboardData.setData('text/plain', MapData.tooltipClipboard());
            }else{
                event.clipboardData.setData('text/plain', MapData.tooltipClipboard);
            }
            event.preventDefault();
        }
    });

    const tooltipUpdate = ts => {
        if(ts && tooltipDirty){
            let tooltipContents = MapData.testTooltip(tooltipX, tooltipY);
            if(tooltipContents != '' && !removeTooltip && !isNavigating){
                tooltip.innerHTML = tooltipContents.replaceAll('\n','<br>');
                let tooltipWidth = tooltip.clientWidth;
                let tooltipHeight = tooltip.clientHeight;
                tooltipX += 5;
                tooltipY += 5;
                if(tooltipWidth+tooltipX + 10 > mapContainer.clientWidth)
                    tooltipX -= tooltipWidth + 15;
                if(tooltipHeight+tooltipY + 10 > mapContainer.clientHeight)
                    tooltipY -= tooltipHeight + 10;
                tooltip.style.transform = `translate(${tooltipX}px, ${tooltipY}px)`;
                tooltip.style.display = '';
                mapCanvas.style.cursor = 'crosshair';
            }else{
                tooltip.style.display = 'none';
                mapCanvas.style.cursor = '';
            }
            isNavigating = false;
            tooltipDirty = false;
        }
        cursorCoordDisplay.innerHTML = `X: ${(MapData.view.unconvertY(tooltipY) * Config.coordScaleFac).toFixed(2)} / Y: ${(MapData.view.unconvertX(tooltipX) * Config.coordScaleFac).toFixed(2)}`;
        requestAnimationFrame(tooltipUpdate);
    }
    tooltipUpdate();
}

async function loadMapperData(file){
    let mDat;
    if(typeof(file) == 'object') mDat = file;
    else if(typeof(file) == 'string') mDat = await (await fetch(new Request(file))).json();

    if(!(mDat && mDat.owners)){
        writeWarning('Invalid JSON data');
        return;
    };
    if(!mDat.version || mDat.version < Config.mapperVersion){
        writeWarning(`Mapper file is out of date (Version ${mDat.version ?? 0}, latest is ${Config.mapperVersion}). Map data may be incomplete or display incorrectly.`);
    }


    const formatVec = (vec, decimals = 1) => {
        return `(${Utils.round(vec.x, decimals)}, ${Utils.round(vec.y, decimals)}, ${Utils.round(vec.z, decimals)})`;
    }
    if(mDat.entities){
        for(let i=0; i<mDat.entities.PersistentIndices.length; i++){
            let ownerIndex = mDat.entities.OwnerIndices[i];
            let markerData = {
                type: 'entity',
                position: {
                    y: mDat.entities.Locations[i].X/Config.coordScaleFac,
                    x: mDat.entities.Locations[i].Y/Config.coordScaleFac,
                    z: mDat.entities.Locations[i].Z/Config.coordScaleFac,
                },
                rotation: {
                    x: mDat.entities.Rotations[i].X,
                    y: mDat.entities.Rotations[i].Y,
                    z: mDat.entities.Rotations[i].Z,
                    w: mDat.entities.Rotations[i].W,
                },
                velocity: {
                    x: mDat.entities.LinearVelocities[i].X,
                    y: mDat.entities.LinearVelocities[i].Y,
                    z: mDat.entities.LinearVelocities[i].Z,
                },
                angularVelocity: {
                    x: mDat.entities.AngularVelocities[i].X,
                    y: mDat.entities.AngularVelocities[i].Y,
                    z: mDat.entities.AngularVelocities[i].Z,
                },
                index: mDat.entities.PersistentIndices[i],
                frozen: mDat.entities.PhysicsLockedFlags[i],
                sleeping: mDat.entities.PhysicsSleepingFlags[i],
                owner: {
                    displayName: mDat.owners.DisplayNames[ownerIndex],
                    userName: mDat.owners.UserNames[ownerIndex],
                    userId: mDat.owners.UserIds[ownerIndex],
                },
            };
            markerData.colors = {};
            for(let colorName in mDat.entities.ColorsAndAlphas[i]){
                markerData.colors[colorName] = new Color(
                    mDat.entities.ColorsAndAlphas[i][colorName].R / 255,
                    mDat.entities.ColorsAndAlphas[i][colorName].G / 255,
                    mDat.entities.ColorsAndAlphas[i][colorName].B / 255,
                    mDat.entities.ColorsAndAlphas[i][colorName].A / 255,
                );
            }
            let instanceInfo = '';
            if(mDat.entities.instances){
                instanceInfo += `<div><b>Type:</b> ${mDat.entities.instances[i].name.replaceAll(/^Entity_/g, '')}</div>`;
                for(let property in mDat.entities.instances[i]){
                    if(property != 'name' && property != 'class'){
                        instanceInfo += `<div><b>${property}:</b> ${mDat.entities.instances[i][property]}</div>`;
                    }
                }
                if(mDat.entities.instances[i].class == 'BrickGridDynamicActor'){
                    delete markerData.colors;
                }
            }
            
            let truePosition = {
                y: markerData.position.x * Config.coordScaleFac,
                x: markerData.position.y * Config.coordScaleFac,
                z: markerData.position.z * Config.coordScaleFac
            };
            let physState;
            if(markerData.frozen){
                physState = 'Frozen';
            }else{
                if(markerData.sleeping) physState = 'Sleeping';
                else physState = 'Awake';
            }
            markerData.tooltip = `<h1>Entity ${markerData.index}</h1><hr>`
                + `<div><b>Owner:</b> ${markerData.owner.displayName} (${markerData.owner.userName}) <span class="smol quiet">${markerData.owner.userId}</span></div>`
                + instanceInfo
                + `<div><b>Position:</b> ${formatVec(truePosition, 2)}</div>`
                + `<div><b>Velocity:</b> ${formatVec(markerData.velocity, 3)}</div>`
                + `<div><b>Angular Velocity:</b> ${formatVec(markerData.angularVelocity, 1)}</div>`
                + `<div>${physState}</div>`
            ;
            if(markerData.colors){
                markerData.tooltip += '<div><b>Colors:</b></div><div style="font-size:16">';
                for(let col in markerData.colors){
                    markerData.tooltip += `<span class="swatch" title="${col}" style="background:${markerData.colors[col].hex}"></span>`;
                }
                markerData.tooltip += '</div>';
            }
            markerData.clipboard = () => `/tp "${document.getElementById('field_username').value}" ${Utils.round(truePosition.x, 2)} ${(Utils.round(truePosition.y, 2))} ${Utils.round(truePosition.z, 2)} 0`;
            MapData.addMarker(markerData);
        }
    }
    if(mDat.chunks){
        for(let chunk of mDat.chunks){
            MapData.addMarker({
                type: 'chunk',
                position: {
                    y: (chunk.position.x * 2048 + 2048)/Config.coordScaleFac,
                    x: (chunk.position.y * 2048)/Config.coordScaleFac,
                    z: (chunk.position.z * 2048)/Config.coordScaleFac,
                },
                tooltip: `Chunk ${chunk.position.x}_${chunk.position.y}_${chunk.position.z}.mps`,
            });
        }
    }
    if(mDat.components){
        for(let component of mDat.components){
            let markerData = {
                type: 'component',
                position:{
                    y: component.position.x / Config.coordScaleFac,
                    x: component.position.y / Config.coordScaleFac,
                    z: component.position.z / Config.coordScaleFac,
                },
                owner: {
                    displayName: mDat.owners.DisplayNames[component.owner],
                    userName: mDat.owners.UserNames[component.owner],
                    userId: mDat.owners.UserIds[component.owner],
                },
                minZoom: 0.1,
            };
            if(component.Input != component.Output){
                if((component.name == 'BrickComponentType_WireGraphPseudo_BufferSeconds'
                    && component.SecondsToWait < 0.1
                    && component.ZeroSecondsToWait < 0.1)
                    ||
                    (component.name == 'BrickComponentType_WireGraphPseudo_BufferTicks')
                    && component.TicksToWait < 10
                    && component.ZeroTicksToWait < 10
                    ){
                    markerData.componentActive = 2;
                    markerData.color = '#f7004aee';
                }else{
                    markerData.componentActive = 1;
                    markerData.color = '#f4ae35dd';
                }
            }else{
                markerData.componentActive = 0;
                markerData.color = '#81e883cc';
            }

            let instanceInfo = '';
            for(let property in component){
                if(!['name', 'class', 'position', 'owner', 'grid'].includes(property)){
                    instanceInfo += `<div><b>${property}:</b> ${component[property]}</div>`;
                }
            }
            markerData.tooltip = `<h1>${component.name.replaceAll(/.*_(.+)$/g, '$1')} Component</h1><hr>`
                + `<div><b>Owner:</b> ${markerData.owner.displayName} (${markerData.owner.userName}) <span class="smol quiet">${markerData.owner.userId}</span></div>`
                + `<div><b>Grid:</b> ${component.grid == 1 ? 'World' : component.grid}</div>`
                + instanceInfo
                + `<div><b>Position:</b> ${formatVec(component.position, 2)}</div>`
            ;
            markerData.clipboard = () => `/tp "${document.getElementById('field_username').value}" ${Utils.round(component.position.x, 2)} ${(Utils.round(component.position.y, 2))} ${Utils.round(component.position.z, 2)} 0`;
            MapData.addMarker(markerData);
        }
    }
}

function redrawMap(){
    MapData.view.pixelRatio = window.devicePixelRatio;
    mapCanvas.width = mapContainer.clientWidth * MapData.view.pixelRatio;
    mapCanvas.height = mapContainer.clientHeight * MapData.view.pixelRatio;
    zoomLevelDisplay.innerHTML = `Zoom: ${(MapData.view.scale*MapData.view.pixelRatio).toFixed(3)}x / ${(1/(MapData.view.scale*MapData.view.pixelRatio * Config.coordScaleFac / 1000)).toFixed(2)} studs/px`;

    let curSprite;
    let spriteSize;
    let textMeasure;
    let tempMeasure = {};
    //Draw Static Markers
    let markerCount = 0;
    for(const marker of MapData.markers){
        curSprite = null;
        marker.visible = false;
        if(marker.hidden || (marker.minZoom && MapData.view.scale < marker.minZoom) || (marker.maxZoom && MapData.view.scale > marker.maxZoom)) continue;
        let markerX = MapData.view.convertX(marker.position.x);
        let markerY = MapData.view.convertY(marker.position.y);
        if(markerX > mapCanvas.width + Config.viewCullMargin || markerX < -Config.viewCullMargin || markerY > mapCanvas.height + Config.viewCullMargin || markerY < -Config.viewCullMargin) continue; // View Culling
        switch(marker.type){
            case 'entity':
                if(!(MapData.layers.markers && MapData.layers.entities)) break;
                if(!MapData.layers.entities_frozen && marker.frozen) break;
                if(!MapData.layers.entities_asleep && marker.sleeping) break;
                if(!MapData.layers.entities_awake && !(marker.frozen || marker.sleeping)) break;
                if(!Utils.testOwner(MapData.searchFilter, marker.owner)) break;
                marker.visible = true;
                markerCount++;
                if(marker.frozen) curSprite = Config.spriteBounds.entity_frozen;
                else if(marker.sleeping) curSprite = Config.spriteBounds.entity_asleep;
                else curSprite = Config.spriteBounds.entity_awake;
                spriteSize = 12;
                break;
            case 'chunk':
                if(!(MapData.layers.brickedchunks)) break;
                marker.visible = true;
                spriteSize = 20.48 * MapData.view.scale;
                mapctx.beginPath();
                mapctx.rect(
                    markerX,
                    markerY,
                    spriteSize,
                    spriteSize
                );
                mapctx.fillStyle = '#81bbe277';
                mapctx.fill();
                if(!marker.tooltipHitzone) marker.tooltipHitzone = {};
                marker.tooltipHitzone.width = spriteSize;
                marker.tooltipHitzone.height = spriteSize;
                marker.tooltipHitzone.offsetX = spriteSize * 0.5;
                marker.tooltipHitzone.offsetY = -spriteSize * 0.5;
                break;
            case 'component':
                if(!(MapData.layers.components)) break;
                if(!Utils.testOwner(MapData.searchFilter, marker.owner)) break;
                marker.visible = true;
                markerCount++;
                spriteSize = Math.max(10, 0.10 * MapData.view.scale);
                mapctx.beginPath();
                mapctx.rect(
                    markerX - 0.5 * spriteSize,
                    markerY - 0.5 * spriteSize,
                    spriteSize,
                    spriteSize
                );
                mapctx.fillStyle = marker.color ?? '#000000aa';
                mapctx.strokeStyle = '#000f';
                mapctx.lineWidth = 1.0;
                mapctx.stroke();
                mapctx.fill();
                if(!marker.tooltipHitzone) marker.tooltipHitzone = {};
                marker.tooltipHitzone.width = spriteSize;
                marker.tooltipHitzone.height = spriteSize;
                //marker.tooltipHitzone.offsetX = spriteSize * 0.5;
                //marker.tooltipHitzone.offsetY = -spriteSize * 0.5;
                break;
            default:
                if(!MapData.layers.markers) break;
                marker.visible = true;
                markerCount++;
                curSprite = Config.spriteBounds.unknown;
                spriteSize = 30;
                break;
        }
        if(curSprite != null){
            mapctx.drawImage(
                mapSprites,
                curSprite.x,
                curSprite.y,
                curSprite.width,
                curSprite.height,
                markerX-(0.5*spriteSize)*MapData.view.pixelRatio,
                markerY-(0.5*spriteSize)*MapData.view.pixelRatio,
                spriteSize*MapData.view.pixelRatio,
                spriteSize*MapData.view.pixelRatio
            );
        }
    }
    markerCountDisplay.innerHTML = markerCount + ' markers visible';
    MapData.view.dirty = false;
}

function writeWarning(warning){
    warningPanel.style.display = 'block';
    warningPanel.innerHTML += warning + '<br>';
}