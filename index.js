'use strict';

import * as Vector from './js/vectorlib.js';
import * as Bezier from './js/bezierlib.js';
import * as Utils from './js/utillib.js';
import {Color} from './js/colorlib.js';
import * as Config from './config.js';
import * as MapData from './js/mapdata.js';
import * as Legend from './legend.js';
import * as Stats from './js/statistics.js';

const mapContainer = document.getElementById('mapContainer');
const mapCanvas = document.getElementById('mapCanvas');
/** The main map drawing context.
 * @type {CanvasRenderingContext2D} */
const mapctx = mapCanvas.getContext('2d');
const mapSprites = document.getElementById('mapSprites');
const zoomLevelDisplay = document.getElementById('zoomLevelDisplay');
const markerCountDisplay = document.getElementById('markerCountDisplay');
const warningPanel = document.getElementById('warningPanel');
const statsPanel = document.getElementById('statsPanel');

let isNavigating = false;

document.addEventListener('DOMContentLoaded', async () => {
    //await loadMapperData('data/mapperdata.json');
    //await loadMapperData('data/mapperdata.gz');
    MapData.sortMarkers();

    MapData.matrix.initialize();
    MapData.view.initialize();
    redrawMap();
    mapNavigationSetup();
    Legend.initialize();
    tooltipSetup();

    //return;
    document.ondragover = document.ondragenter = event => {
        event.preventDefault();
    }
    document.ondrop = async event => {
        event.preventDefault();
        MapData.reset();
        warningPanel.innerHTML = '';
        warningPanel.style.display = 'none';
        for(let item of event.dataTransfer.items){
            if(item.kind != 'file') continue;
            console.log(item.type)
            if(item.type === 'application/json' || item.type === 'text/json'){
                await loadMapperData(JSON.parse(await(item.getAsFile().text())));
            }else if(item.type === 'application/x-gzip'){
                await loadMapperData(await new Response(item.getAsFile().stream().pipeThrough(new DecompressionStream('gzip'))).json());
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
    mapContainer.addEventListener('contextmenu', e => {
        touchCache = [];
        touchCount = 0;
    });

    document.getElementById('navZoomIn').addEventListener('click', e => {navButtonInput('zoomIn');});
    document.getElementById('navZoomOut').addEventListener('click', e => {navButtonInput('zoomOut');});

    const navSkew = document.getElementById('navSkew');
    const navSkewHandle = document.getElementById('navSkewHandle');
    const skewPow = 2;
    const setSkew = (x, y) => {
        navSkewHandle.style.transform = `translate(${x*navSkew.clientWidth*0.5}px, ${y*navSkew.clientHeight*0.5}px)`;
        x = Math.sign(x) * Math.pow(Math.abs(x), skewPow);
        y = Math.sign(y) * Math.pow(Math.abs(y), skewPow);
        MapData.view.skewX = x * 2;
        MapData.view.skewY = y * 2;
        MapData.view.dirty = true;
    };
    const skewDownHandler = e => {
        skewMoveHandler(e);
        navSkew.addEventListener('pointermove', skewMoveHandler);

        document.addEventListener('pointerup', skewUpHandler);
        document.addEventListener('pointercancel', skewUpHandler);
        //navSkew.addEventListener('pointerleave', skewUpHandler);
    };
    const skewUpHandler = e => {
        navSkew.removeEventListener('pointermove', skewMoveHandler);

        document.removeEventListener('pointerup', skewUpHandler);
        document.removeEventListener('pointercancel', skewUpHandler);
        //navSkew.removeEventListener('pointerleave', skewUpHandler);
    };
    const skewMoveHandler = e => {
        let x = (e.offsetX / navSkew.clientWidth) * 2 - 1;
        let y = (e.offsetY / navSkew.clientHeight) * 2 - 1;
        setSkew(x, y);
    };
    navSkew.addEventListener('pointerdown', skewDownHandler);
    navSkew.addEventListener('contextmenu', e => {e.preventDefault(); setSkew(0,0)});
    navUpdate();
}

function tooltipSetup(){
    const tooltip = document.getElementById('tooltip');
    const cursorCoordDisplay = document.getElementById('cursorCoordDisplay');
    let tooltipX = 0;
    let tooltipY = 0;
    let tooltipDirty = false;
    let removeTooltip = false;
    let freezeTooltip = false;
    let tooltipActive = false;
    let mouseOverTooltip = false;
    let prevTooltipContents;

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
        let newClipboard = Utils.customClipboard ?? MapData.tooltipClipboard;
        if(mouseOverTooltip) newClipboard = Utils.customClipboard;
        if(newClipboard){
            if(typeof(newClipboard) == 'function'){
                event.clipboardData.setData('text/plain', newClipboard());
            }else{
                event.clipboardData.setData('text/plain', newClipboard);
            }
            event.preventDefault();
        }
    });

    document.addEventListener('keydown', e => {
        if(e.key == 'Control'){
            freezeTooltip = true;
            tooltip.style.pointerEvents = 'auto';
        }
    });
    document.addEventListener('keyup', e => {
        if(e.key == 'Control'){
            freezeTooltip = false;
            tooltipDirty = true;
            if(!mouseOverTooltip) tooltip.style.pointerEvents = 'none';
        }
    });
    tooltip.addEventListener('mouseenter', e => {
        if(freezeTooltip) mouseOverTooltip = true;
    });
    tooltip.addEventListener('mouseleave', e => {
        mouseOverTooltip = false;
        if(!freezeTooltip) tooltip.style.pointerEvents = 'none';
    });

    const tooltipUpdate = ts => {
        let oldTooltipX = tooltipX;
        let oldTooltipY = tooltipY;
        if(ts && tooltipDirty){
            let tooltipContents = MapData.testTooltip(tooltipX, tooltipY);
            if(typeof(tooltipContents) == 'function') tooltipContents = tooltipContents();
            if(tooltipContents != '' && !removeTooltip && !isNavigating){
                if(!(freezeTooltip || mouseOverTooltip) || !tooltipActive){
                    if(tooltipContents != prevTooltipContents){
                        tooltip.innerHTML = tooltipContents.replaceAll('\n','<br>');
                        Utils.attachClipboardHooks(tooltip);
                        prevTooltipContents = tooltipContents;
                    }
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
                    tooltipActive = true;
                }
            }else{
                if(!(freezeTooltip || mouseOverTooltip)){
                    tooltip.style.display = 'none';
                    tooltipActive = false;
                }
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
    else if(typeof(file) == 'string'){
        let fileResponse = await fetch(new Request(file));
        if(!fileResponse.ok){
            console.log(`Invalid file at ${file}`);
            return;
        }
        if(file.endsWith('.json')){
            mDat = await (fileResponse).json();
        }else if(file.endsWith('.gz')){
            mDat = await new Response(fileResponse.body.pipeThrough(new DecompressionStream('gzip'))).json();
        }
    }

    if(!(mDat && mDat.owners)){
        writeWarning('Invalid JSON data');
        return;
    };
    if(!mDat.version || mDat.version < Config.mapperVersion){
        writeWarning(`Mapper file is out of date (Version ${mDat.version ?? 0}, latest is ${Config.mapperVersion}). Map data may be incomplete or display incorrectly.`);
    }


    const formatVec = (vec, decimals = 1) => {
        return `(${Utils.round(vec.x ?? vec.X ?? vec.Pitch, decimals)}, ${Utils.round(vec.y ?? vec.Y ?? vec.Yaw, decimals)}, ${Utils.round(vec.z ?? vec.Z ?? vec.Roll, decimals)}${(vec.w ?? vec.W) ? `, ${Utils.round(vec.w ?? vec.W, decimals)}` : ''})`;
    }
    const formatProperties = (object, ignoreList) => {
        let finalProperty;
        let result = '';
        for(let property in object){
            if(!ignoreList.includes(property)){
                if(typeof(object[property]) == 'object'){
                    if((object[property].X != null && object[property].Y != null && object[property].Z != null) || (object[property].Pitch != null && object[property].Yaw != null && object[property].Roll != null)){
                        object[property] = formatVec(object[property], 2);
                    }else{
                        object[property] = JSON.stringify(object[property], null, 2);
                    }
                }
                if(typeof(object[property]) == 'string') finalProperty = object[property].replaceAll(/[\n\r\s]+/gm, ' ');
                if(typeof(object[property]) == 'string' && object[property].length > Config.maxPropertyStringLength){
                    finalProperty = `<span title="Ctrl+C to copy full contents" class="highlight" data-clipboard="${encodeURIComponent(object[property])}">${Utils.sanitize(finalProperty.substring(0,Config.maxPropertyStringLength))}...</span>`;
                }
                else
                    finalProperty = Utils.sanitize(object[property]);
                result += `<div><b>${property}:</b> ${finalProperty}</div>`;
            }
        }
        return result;
    }
    const getTpCommand = (vec, scaleFactor = 1) => {
        return `/tp "${document.getElementById('field_username').value}" ${Utils.round((vec.x ?? vec.X) * scaleFactor, 2)} ${(Utils.round((vec.y ?? vec.Y) * scaleFactor, 2))} ${Utils.round((vec.z ?? vec.Z) * scaleFactor, 2)} 0`;
    }
    for(let i=0; i<mDat.owners.UserIds.length; i++){
        Stats.addUser(mDat.owners.UserIds[i], {
            displayName: Utils.sanitize(mDat.owners.DisplayNames[i]),
            userName: Utils.sanitize(mDat.owners.UserNames[i]),
        });
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
                if(mDat.entities.instances[i].class == 'BrickGridDynamicActor'){
                    if(mDat.entities.instances[i].hasEngine) markerData.hasEngine = true;
                    markerData.isGrid = true;
                    delete markerData.colors;
                }
                instanceInfo += formatProperties(mDat.entities.instances[i], ['name', 'class']);
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
                + `<div><b>Owner:</b> ${Utils.sanitize(markerData.owner.displayName)} (${Utils.sanitize(markerData.owner.userName)}) <span class="smol quiet"><a href="https://www.brickadia.com/users/${markerData.owner.userId}">${markerData.owner.userId}</a></span></div>`
                + instanceInfo
                + `<div><b>Position:</b> ${formatVec(truePosition, 2)}</div>`
                + `<div><b>Velocity:</b> ${formatVec(markerData.velocity, 3)}</div>`
                + `<div><b>Angular Velocity:</b> ${formatVec(markerData.angularVelocity, 1)}</div>`
                + `<div>${physState}</div>`
            ;
            if(markerData.colors){
                markerData.tooltip += '<div><b>Colors:</b></div><div style="font-size:16px">';
                for(let col in markerData.colors){
                    markerData.tooltip += `<span class="swatch" title="${col}" style="background:${markerData.colors[col].hex}"></span>`;
                }
                markerData.tooltip += '</div>';
            }
            markerData.clipboard = () => getTpCommand(truePosition);
            MapData.addMarker(markerData);
        }
    }
    if(mDat.chunks){
        for(let chunk of mDat.chunks){
            let markerData = {
                type: 'chunk',
                position: {
                    y: (chunk.position.x + chunk.size * 0.5)/Config.coordScaleFac,
                    x: (chunk.position.y + chunk.size * -0.5)/Config.coordScaleFac,
                    z: (chunk.position.z + chunk.size * 0.5)/Config.coordScaleFac,
                },
                chunkBoundsSize: {
                    x: chunk.boundsMax.x - chunk.boundsMin.x,
                    y: chunk.boundsMax.y - chunk.boundsMin.y,
                    z: chunk.boundsMax.z - chunk.boundsMin.z,
                },
                chunkAveragePosition: { //Average by halving then adding to avoid any chance of overflow/underflow
                    x: chunk.boundsMin.x * 0.5 + chunk.boundsMax.x * 0.5,
                    y: chunk.boundsMin.y * 0.5 + chunk.boundsMax.y * 0.5,
                    z: chunk.boundsMin.z * 0.5 + chunk.boundsMax.z * 0.5,
                },
                chunkBoundsMin: chunk.boundsMin,
                chunkBoundsMax: chunk.boundsMax,
                chunkGeometricMedian: chunk.geometricMedian,
                chunkSize: chunk.size,
                cullOffsetX: 1024 / Config.coordScaleFac,
                cullOffsetY: 1024 / Config.coordScaleFac,
            };
            markerData.chunkBorderMin = {
                x: chunk.position.x + chunk.size * -0.5,
                y: chunk.position.y + chunk.size * -0.5,
                z: chunk.position.z + chunk.size * -0.5,
            };
            markerData.chunkBorderMax = {
                x: chunk.position.x + chunk.size * 0.5,
                y: chunk.position.y + chunk.size * 0.5,
                z: chunk.position.z + chunk.size * 0.5,
            };
            markerData.tooltip = () => `Chunk ${chunk.index3d.x}_${chunk.index3d.y}_${chunk.index3d.z}.mps<hr>`
            +`<div><b>Chunk Center</b>: <span data-clipboard="${encodeURIComponent(getTpCommand(chunk.position))}">${formatVec(chunk.position)}</span></div>`
            +`<div><b>Largest Cluster</b>: <span data-clipboard="${encodeURIComponent(getTpCommand(markerData.chunkGeometricMedian))}">${formatVec(markerData.chunkGeometricMedian)}</span></div>`
            +`<div><b>Brick Bounds Center</b>: <span data-clipboard="${encodeURIComponent(getTpCommand(markerData.chunkAveragePosition))}">${formatVec(markerData.chunkAveragePosition)}</span></div>`
            +`<div><b>Brick Bounds Size</b>: ${formatVec(markerData.chunkBoundsSize)}</div>`
            +`<div>${chunk.brickCount} bricks</div>`
            +`<div>${chunk.componentCount} components</div>`
            +`<div>${chunk.wireCount} wires</div>`
            +`<div>`;
            markerData.clipboard = () => MapData.layers.chunk_display & 2 ? getTpCommand(chunk.geometricMedian) : getTpCommand(chunk.position);
            MapData.addMarker(markerData);
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
                componentImpact: 1,
            };

            let instanceInfo = '';
            let finalProperty;
            markerData.tooltip = `<h1>${component.name.replaceAll(/.*_(.+)$/g, '$1')} Component</h1><hr>`
                + `<div><b>Owner:</b> ${Utils.sanitize(markerData.owner.displayName)} (${Utils.sanitize(markerData.owner.userName)}) <span class="smol quiet"><a href="https://www.brickadia.com/users/${markerData.owner.userId}">${markerData.owner.userId}</a></span></div>`
                + `<div><b>Grid:</b> ${component.grid == 1 ? 'World' : component.grid}</div>`
                + formatProperties(component, ['name', 'class', 'position', 'owner', 'grid'])
                + `<div><b>Position:</b> ${formatVec(component.position, 2)}</div>`
            ;
            switch(component.name){
                case 'BrickComponentType_WireGraphPseudo_BufferTicks':
                case 'BrickComponentType_WireGraphPseudo_BufferSeconds':
                    markerData.componentCategory = 'buffers';
                    if(component.Input != component.Output){
                        if((component.name == 'BrickComponentType_WireGraphPseudo_BufferSeconds'
                            && component.SecondsToWait < 0.1
                            && component.ZeroSecondsToWait < 0.1)
                            ||
                            (component.name == 'BrickComponentType_WireGraphPseudo_BufferTicks')
                            && component.TicksToWait < 10
                            && component.ZeroTicksToWait < 10
                            ){
                            markerData.componentImpact = 3;
                        }else{
                            markerData.componentImpact = 2;
                        }
                    }else{
                        markerData.componentImpact = 1;
                    }
                    break;
                case 'Component_PointLight':
                case 'Component_SpotLight':
                    markerData.componentCategory = 'lights';
                    if(!component.bEnabled) markerData.componentImpact = 0;
                    else if((component.bCastShadows && component.Radius > 100) || component.Radius > 6000 || component.Brightness > 6000) markerData.componentImpact = 3;
                    else if(component.bCastShadows || component.Radius > 400 || component.Radius < 0 || component.Brightness < 0 || component.Brightness > 400) markerData.componentImpact = 2;
                    markerData.componentRadius = component.Radius;
                    break;
                case 'BrickComponentType_Internal_TeleportDestination':
                    markerData.componentImpact = 0;
                    // fallthrough
                case 'BrickComponentType_WireGraph_Exec_Entity_Teleport':
                case 'BrickComponentType_WireGraph_Exec_Entity_RelativeTeleport':
                case 'BrickComponentType_WireGraph_Exec_Entity_SetRotation':
                case 'BrickComponentType_WireGraph_Exec_Entity_SetLocationRotation':
                case 'BrickComponentType_WireGraph_Exec_Entity_SetLocation':
                case 'BrickComponentType_WireGraph_Exec_Entity_AddLocationRotation':
                    markerData.componentCategory = 'teleports';
                    break;
                case 'Component_WireGraph_PlayAudioAt':
                case 'Component_OneShotAudioEmitter':
                case 'Component_AudioEmitter':
                    markerData.componentCategory = 'sounds';
                    if(component.bEnabled) markerData.componentImpact = 1;
                    else markerData.componentImpact = 0;
                    if(component.name != 'Component_WireGraph_PlayAudioAt')
                        markerData.componentRadius = component.MaxDistance;
                    break;
                case 'Component_BotSpawn':
                    markerData.componentCategory = 'bots';
                    if(component.bSpawnEnable){
                        if(component.bActiveBot) markerData.componentImpact = 3;
                        else markerData.componentImpact = 2;
                    }else markerData.componentImpact = 1;
                    break;
                case 'Component_Internal_WheelEngine':
                case 'Component_Internal_WeightBrick':
                    markerData.componentCategory = 'weights';
                    break;
                case 'BrickComponentType_WireGraph_Exec_Entity_AddVelocity':
                case 'BrickComponentType_WireGraph_Exec_Entity_SetVelocity':
                    markerData.componentCategory = 'velocities';
                    break;
                case 'BrickComponentType_WireGraph_Exec_Entity_SetGravityDirection':
                    markerData.componentCategory = 'gravities';
                    break;
                case 'Component_ItemSpawn':
                    markerData.componentCategory = 'itemspawners';
                    if(component.PickupScale > 10 || component.PickupScale < -10) markerData.componentImpact = 3;
                    else if(!component.bPickupEnabled) markerData.componentImpact = 0;
                    break;
                case 'Component_SpawnPoint':
                case 'Component_CheckPoint':
                    markerData.componentCategory = 'respawners';
                    if(component.name == 'Component_CheckPoint') markerData.componentImpact = 0;
                    else if(markerData.owner.userId == 'ffffffff-ffff-ffff-ffff-ffffffffffff') markerData.componentImpact = 2;
                    break;
                case 'Component_BrickPropertyChanger':
                    markerData.componentCategory = 'propertychangers';
                    break;
                default:
                    markerData.componentCategory = 'others';
                    break;
            }
            markerData.clipboard = () => getTpCommand(component.position);
            MapData.addMarker(markerData);
        }
    }
}

function redrawMap(){
    MapData.view.pixelRatio = window.devicePixelRatio;
    mapCanvas.width = mapContainer.clientWidth * MapData.view.pixelRatio;
    mapCanvas.height = mapContainer.clientHeight * MapData.view.pixelRatio;
    zoomLevelDisplay.innerHTML = `Zoom: ${(MapData.view.scale*MapData.view.pixelRatio).toFixed(3)}x / ${(1/(MapData.view.scale*MapData.view.pixelRatio * Config.coordScaleFac / 1000)).toFixed(2)} studs/px`;

    let worldBorderSize = (2097152 / Config.coordScaleFac) * MapData.view.scale * MapData.view.pixelRatio;
    mapctx.beginPath();
    mapctx.lineWidth = 2;
    mapctx.strokeStyle = Config.colors.grid;
    mapctx.strokeRect(
        MapData.view.convertX(0, 0) - 0.5 * worldBorderSize,
        MapData.view.convertY(0, 0) - 0.5 * worldBorderSize,
        worldBorderSize,
        worldBorderSize,
    );

    let curSprite;
    let spriteSize;
    let tmp = {};
    //Draw Static Markers
    let markerCount = 0;
    Stats.resetCounts();
    let markerX;
    let markerY;
    const drawCube = (min, max, wireframe, marker) => {
        tmp.is2d = !MapData.view.skewX && !MapData.view.skewY;
        tmp.p1x = MapData.view.convertX(min.y / Config.coordScaleFac, min.z / Config.coordScaleFac);
        tmp.p1y = MapData.view.convertY(min.x / Config.coordScaleFac, min.z / Config.coordScaleFac);
        tmp.p2x = MapData.view.convertX(max.y / Config.coordScaleFac, min.z / Config.coordScaleFac);
        tmp.p2y = MapData.view.convertY(min.x / Config.coordScaleFac, min.z / Config.coordScaleFac);
        tmp.p3x = MapData.view.convertX(min.y / Config.coordScaleFac, min.z / Config.coordScaleFac);
        tmp.p3y = MapData.view.convertY(max.x / Config.coordScaleFac, min.z / Config.coordScaleFac);
        tmp.p4x = MapData.view.convertX(max.y / Config.coordScaleFac, min.z / Config.coordScaleFac);
        tmp.p4y = MapData.view.convertY(max.x / Config.coordScaleFac, min.z / Config.coordScaleFac);
        if(!tmp.is2d){
            tmp.p5x = MapData.view.convertX(min.y / Config.coordScaleFac, max.z / Config.coordScaleFac);
            tmp.p5y = MapData.view.convertY(min.x / Config.coordScaleFac, max.z / Config.coordScaleFac);
            tmp.p6x = MapData.view.convertX(max.y / Config.coordScaleFac, max.z / Config.coordScaleFac);
            tmp.p6y = MapData.view.convertY(min.x / Config.coordScaleFac, max.z / Config.coordScaleFac);
            tmp.p7x = MapData.view.convertX(min.y / Config.coordScaleFac, max.z / Config.coordScaleFac);
            tmp.p7y = MapData.view.convertY(max.x / Config.coordScaleFac, max.z / Config.coordScaleFac);
            tmp.p8x = MapData.view.convertX(max.y / Config.coordScaleFac, max.z / Config.coordScaleFac);
            tmp.p8y = MapData.view.convertY(max.x / Config.coordScaleFac, max.z / Config.coordScaleFac);
        }
        if(wireframe){
            if(tmp.is2d){
                mapctx.moveTo(tmp.p1x, tmp.p1y);
                mapctx.lineTo(tmp.p2x, tmp.p2y);
                mapctx.lineTo(tmp.p4x, tmp.p4y);
                mapctx.lineTo(tmp.p3x, tmp.p3y);
                mapctx.lineTo(tmp.p1x, tmp.p1y);
            }else{
                if(MapData.view.skewX > 0 && MapData.view.skewY > 0){
                    mapctx.moveTo(tmp.p1x, tmp.p1y);
                    mapctx.lineTo(tmp.p5x, tmp.p5y);
                    mapctx.lineTo(tmp.p6x, tmp.p6y);
                    mapctx.lineTo(tmp.p8x, tmp.p8y);
                    mapctx.lineTo(tmp.p4x, tmp.p4y);
                    mapctx.lineTo(tmp.p3x, tmp.p3y);
                    mapctx.lineTo(tmp.p1x, tmp.p1y);
                    mapctx.moveTo(tmp.p5x, tmp.p5y);
                    mapctx.lineTo(tmp.p7x, tmp.p7y);
                    mapctx.lineTo(tmp.p8x, tmp.p8y);
                    mapctx.moveTo(tmp.p7x, tmp.p7y);
                    mapctx.lineTo(tmp.p3x, tmp.p3y);
                    if(marker.tooltipHitPoly){
                        marker.tooltipHitPoly[0] = tmp.p1x; marker.tooltipHitPoly[1] = tmp.p1y;
                        marker.tooltipHitPoly[2] = tmp.p5x; marker.tooltipHitPoly[3] = tmp.p5y;
                        marker.tooltipHitPoly[4] = tmp.p6x; marker.tooltipHitPoly[5] = tmp.p6y;
                        marker.tooltipHitPoly[6] = tmp.p8x; marker.tooltipHitPoly[7] = tmp.p8y;
                        marker.tooltipHitPoly[8] = tmp.p4x; marker.tooltipHitPoly[9] = tmp.p4y;
                        marker.tooltipHitPoly[10] = tmp.p3x; marker.tooltipHitPoly[11] = tmp.p3y;
                    }
                }else if(MapData.view.skewX > 0 && MapData.view.skewY <= 0){
                    mapctx.moveTo(tmp.p2x, tmp.p2y);
                    mapctx.lineTo(tmp.p6x, tmp.p6y);
                    mapctx.lineTo(tmp.p8x, tmp.p8y);
                    mapctx.lineTo(tmp.p7x, tmp.p7y);
                    mapctx.lineTo(tmp.p3x, tmp.p3y);
                    mapctx.lineTo(tmp.p1x, tmp.p1y);
                    mapctx.lineTo(tmp.p2x, tmp.p2y);
                    mapctx.moveTo(tmp.p6x, tmp.p6y);
                    mapctx.lineTo(tmp.p5x, tmp.p5y);
                    mapctx.lineTo(tmp.p7x, tmp.p7y);
                    mapctx.moveTo(tmp.p5x, tmp.p5y);
                    mapctx.lineTo(tmp.p1x, tmp.p1y);
                    if(marker.tooltipHitPoly){
                        marker.tooltipHitPoly[0] = tmp.p2x; marker.tooltipHitPoly[1] = tmp.p2y;
                        marker.tooltipHitPoly[2] = tmp.p6x; marker.tooltipHitPoly[3] = tmp.p6y;
                        marker.tooltipHitPoly[4] = tmp.p8x; marker.tooltipHitPoly[5] = tmp.p8y;
                        marker.tooltipHitPoly[6] = tmp.p7x; marker.tooltipHitPoly[7] = tmp.p7y;
                        marker.tooltipHitPoly[8] = tmp.p3x; marker.tooltipHitPoly[9] = tmp.p3y;
                        marker.tooltipHitPoly[10] = tmp.p1x; marker.tooltipHitPoly[11] = tmp.p1y;
                    }
                }else if(MapData.view.skewX <= 0 && MapData.view.skewY <= 0){
                    mapctx.moveTo(tmp.p4x, tmp.p4y);
                    mapctx.lineTo(tmp.p8x, tmp.p8y);
                    mapctx.lineTo(tmp.p7x, tmp.p7y);
                    mapctx.lineTo(tmp.p5x, tmp.p5y);
                    mapctx.lineTo(tmp.p1x, tmp.p1y);
                    mapctx.lineTo(tmp.p2x, tmp.p2y);
                    mapctx.lineTo(tmp.p4x, tmp.p4y);
                    mapctx.moveTo(tmp.p8x, tmp.p8y);
                    mapctx.lineTo(tmp.p6x, tmp.p6y);
                    mapctx.lineTo(tmp.p5x, tmp.p5y);
                    mapctx.moveTo(tmp.p6x, tmp.p6y);
                    mapctx.lineTo(tmp.p2x, tmp.p2y);
                    if(marker.tooltipHitPoly){
                        marker.tooltipHitPoly[0] = tmp.p4x; marker.tooltipHitPoly[1] = tmp.p4y;
                        marker.tooltipHitPoly[2] = tmp.p8x; marker.tooltipHitPoly[3] = tmp.p8y;
                        marker.tooltipHitPoly[4] = tmp.p7x; marker.tooltipHitPoly[5] = tmp.p7y;
                        marker.tooltipHitPoly[6] = tmp.p5x; marker.tooltipHitPoly[7] = tmp.p5y;
                        marker.tooltipHitPoly[8] = tmp.p1x; marker.tooltipHitPoly[9] = tmp.p1y;
                        marker.tooltipHitPoly[10] = tmp.p2x; marker.tooltipHitPoly[11] = tmp.p2y;
                    }
                }else{
                    mapctx.moveTo(tmp.p3x, tmp.p3y);
                    mapctx.lineTo(tmp.p7x, tmp.p7y);
                    mapctx.lineTo(tmp.p5x, tmp.p5y);
                    mapctx.lineTo(tmp.p6x, tmp.p6y);
                    mapctx.lineTo(tmp.p2x, tmp.p2y);
                    mapctx.lineTo(tmp.p4x, tmp.p4y);
                    mapctx.lineTo(tmp.p3x, tmp.p3y);
                    mapctx.moveTo(tmp.p7x, tmp.p7y);
                    mapctx.lineTo(tmp.p8x, tmp.p8y);
                    mapctx.lineTo(tmp.p6x, tmp.p6y);
                    mapctx.moveTo(tmp.p8x, tmp.p8y);
                    mapctx.lineTo(tmp.p4x, tmp.p4y);
                    if(marker.tooltipHitPoly){
                        marker.tooltipHitPoly[0] = tmp.p3x; marker.tooltipHitPoly[1] = tmp.p3y;
                        marker.tooltipHitPoly[2] = tmp.p7x; marker.tooltipHitPoly[3] = tmp.p7y;
                        marker.tooltipHitPoly[4] = tmp.p5x; marker.tooltipHitPoly[5] = tmp.p5y;
                        marker.tooltipHitPoly[6] = tmp.p6x; marker.tooltipHitPoly[7] = tmp.p6y;
                        marker.tooltipHitPoly[8] = tmp.p2x; marker.tooltipHitPoly[9] = tmp.p2y;
                        marker.tooltipHitPoly[10] = tmp.p4x; marker.tooltipHitPoly[11] = tmp.p4y;
                    }
                }
            }
            mapctx.stroke();
        }else{
            if(tmp.is2d){
                mapctx.moveTo(tmp.p1x, tmp.p1y);
                mapctx.lineTo(tmp.p2x, tmp.p2y);
                mapctx.lineTo(tmp.p4x, tmp.p4y);
                mapctx.lineTo(tmp.p3x, tmp.p3y);
                mapctx.lineTo(tmp.p1x, tmp.p1y);
                if(marker.tooltipHitPoly){
                    marker.tooltipHitPoly[0] = tmp.p1x; marker.tooltipHitPoly[1] = tmp.p1y;
                    marker.tooltipHitPoly[2] = tmp.p2x; marker.tooltipHitPoly[3] = tmp.p2y;
                    marker.tooltipHitPoly[4] = tmp.p4x; marker.tooltipHitPoly[5] = tmp.p4y;
                    marker.tooltipHitPoly[6] = tmp.p3x; marker.tooltipHitPoly[7] = tmp.p3y;
                    if(marker.tooltipHitPoly.length > 8) marker.tooltipHitPoly.splice(8, marker.tooltipHitPoly.length-8);
                }
            }else{
                if(MapData.view.skewX > 0 && MapData.view.skewY > 0){
                    mapctx.moveTo(tmp.p1x, tmp.p1y);
                    mapctx.lineTo(tmp.p5x, tmp.p5y);
                    mapctx.lineTo(tmp.p6x, tmp.p6y);
                    mapctx.lineTo(tmp.p8x, tmp.p8y);
                    mapctx.lineTo(tmp.p4x, tmp.p4y);
                    mapctx.lineTo(tmp.p3x, tmp.p3y);
                    if(marker.tooltipHitPoly){
                        marker.tooltipHitPoly[0] = tmp.p1x; marker.tooltipHitPoly[1] = tmp.p1y;
                        marker.tooltipHitPoly[2] = tmp.p5x; marker.tooltipHitPoly[3] = tmp.p5y;
                        marker.tooltipHitPoly[4] = tmp.p6x; marker.tooltipHitPoly[5] = tmp.p6y;
                        marker.tooltipHitPoly[6] = tmp.p8x; marker.tooltipHitPoly[7] = tmp.p8y;
                        marker.tooltipHitPoly[8] = tmp.p4x; marker.tooltipHitPoly[9] = tmp.p4y;
                        marker.tooltipHitPoly[10] = tmp.p3x; marker.tooltipHitPoly[11] = tmp.p3y;
                    }
                }else if(MapData.view.skewX > 0 && MapData.view.skewY <= 0){
                    mapctx.moveTo(tmp.p2x, tmp.p2y);
                    mapctx.lineTo(tmp.p6x, tmp.p6y);
                    mapctx.lineTo(tmp.p8x, tmp.p8y);
                    mapctx.lineTo(tmp.p7x, tmp.p7y);
                    mapctx.lineTo(tmp.p3x, tmp.p3y);
                    mapctx.lineTo(tmp.p1x, tmp.p1y);
                    if(marker.tooltipHitPoly){
                        marker.tooltipHitPoly[0] = tmp.p2x; marker.tooltipHitPoly[1] = tmp.p2y;
                        marker.tooltipHitPoly[2] = tmp.p6x; marker.tooltipHitPoly[3] = tmp.p6y;
                        marker.tooltipHitPoly[4] = tmp.p8x; marker.tooltipHitPoly[5] = tmp.p8y;
                        marker.tooltipHitPoly[6] = tmp.p7x; marker.tooltipHitPoly[7] = tmp.p7y;
                        marker.tooltipHitPoly[8] = tmp.p3x; marker.tooltipHitPoly[9] = tmp.p3y;
                        marker.tooltipHitPoly[10] = tmp.p1x; marker.tooltipHitPoly[11] = tmp.p1y;
                    }
                }else if(MapData.view.skewX <= 0 && MapData.view.skewY <= 0){
                    mapctx.moveTo(tmp.p4x, tmp.p4y);
                    mapctx.lineTo(tmp.p8x, tmp.p8y);
                    mapctx.lineTo(tmp.p7x, tmp.p7y);
                    mapctx.lineTo(tmp.p5x, tmp.p5y);
                    mapctx.lineTo(tmp.p1x, tmp.p1y);
                    mapctx.lineTo(tmp.p2x, tmp.p2y);
                    if(marker.tooltipHitPoly){
                        marker.tooltipHitPoly[0] = tmp.p4x; marker.tooltipHitPoly[1] = tmp.p4y;
                        marker.tooltipHitPoly[2] = tmp.p8x; marker.tooltipHitPoly[3] = tmp.p8y;
                        marker.tooltipHitPoly[4] = tmp.p7x; marker.tooltipHitPoly[5] = tmp.p7y;
                        marker.tooltipHitPoly[6] = tmp.p5x; marker.tooltipHitPoly[7] = tmp.p5y;
                        marker.tooltipHitPoly[8] = tmp.p1x; marker.tooltipHitPoly[9] = tmp.p1y;
                        marker.tooltipHitPoly[10] = tmp.p2x; marker.tooltipHitPoly[11] = tmp.p2y;
                    }
                }else{
                    mapctx.moveTo(tmp.p3x, tmp.p3y);
                    mapctx.lineTo(tmp.p7x, tmp.p7y);
                    mapctx.lineTo(tmp.p5x, tmp.p5y);
                    mapctx.lineTo(tmp.p6x, tmp.p6y);
                    mapctx.lineTo(tmp.p2x, tmp.p2y);
                    mapctx.lineTo(tmp.p4x, tmp.p4y);
                    if(marker.tooltipHitPoly){
                        marker.tooltipHitPoly[0] = tmp.p3x; marker.tooltipHitPoly[1] = tmp.p3y;
                        marker.tooltipHitPoly[2] = tmp.p7x; marker.tooltipHitPoly[3] = tmp.p7y;
                        marker.tooltipHitPoly[4] = tmp.p5x; marker.tooltipHitPoly[5] = tmp.p5y;
                        marker.tooltipHitPoly[6] = tmp.p6x; marker.tooltipHitPoly[7] = tmp.p6y;
                        marker.tooltipHitPoly[8] = tmp.p2x; marker.tooltipHitPoly[9] = tmp.p2y;
                        marker.tooltipHitPoly[10] = tmp.p4x; marker.tooltipHitPoly[11] = tmp.p4y;
                    }
                }
                if(marker.tooltipHitPoly && marker.tooltipHitPoly.length > 12) marker.tooltipHitPoly.splice(12, marker.tooltipHitPoly.length-12);
            }
            mapctx.fill();
        }
    };
    for(const marker of MapData.markers){
        curSprite = null;
        marker.visible = false;
        if(marker.hidden || (marker.minZoom && MapData.view.scale < marker.minZoom) || (marker.maxZoom && MapData.view.scale > marker.maxZoom)) continue;
        if(!marker.tooltipPosition) marker.tooltipPosition = {};
        if(marker.type != 'chunk'){
            markerX = MapData.view.convertX(marker.position.x, marker.position.z);
            markerY = MapData.view.convertY(marker.position.y, marker.position.z);
            if( markerX + (marker.cullOffsetX ?? 0) * MapData.view.scale * MapData.view.pixelRatio > mapCanvas.width + Config.viewCullMargin ||
                markerX + (marker.cullOffsetX ?? 0) * MapData.view.scale * MapData.view.pixelRatio < -Config.viewCullMargin ||
                markerY + (marker.cullOffsetY ?? 0) * MapData.view.scale * MapData.view.pixelRatio > mapCanvas.height + Config.viewCullMargin ||
                markerY + (marker.cullOffsetY ?? 0) * MapData.view.scale * MapData.view.pixelRatio < -Config.viewCullMargin )
                    continue; // View Culling
            marker.tooltipPosition.x = markerX / MapData.view.pixelRatio;
            marker.tooltipPosition.y = markerY / MapData.view.pixelRatio;
        }
        switch(marker.type){
            case 'entity':
                if(!(MapData.layers.markers && MapData.layers.entities)) break;
                if(!MapData.layers.entities_frozen && marker.frozen) break;
                if(!MapData.layers.entities_asleep && marker.sleeping) break;
                if(!MapData.layers.entities_awake && !(marker.frozen || marker.sleeping)) break;
                if(!Utils.testOwner(MapData.searchFilter, marker.owner)) break;
                if(!(
                       MapData.layers.entity_mask & 1 && marker.isGrid && !marker.hasEngine
                    || MapData.layers.entity_mask & 2 && marker.isGrid && marker.hasEngine
                    || MapData.layers.entity_mask & 4 && !marker.isGrid
                )) break;
                marker.visible = true;
                markerCount++;
                Stats.addCountForUser(marker.owner.userId);
                spriteSize = 5;
                if(marker.frozen) mapctx.fillStyle = Config.colors.entity_frozen;
                else if(marker.sleeping) mapctx.fillStyle = Config.colors.entity_asleep;
                else mapctx.fillStyle = Config.colors.entity_awake;
                mapctx.strokeStyle = Config.colors.outline;
                mapctx.lineWidth = 2.0;
                mapctx.beginPath();
                mapctx.arc(
                    markerX,
                    markerY,
                    spriteSize,
                    0,
                    2 * Math.PI
                );
                mapctx.stroke();
                mapctx.fill();
                if(!marker.tooltipHitzone) marker.tooltipHitzone = {};
                marker.tooltipHitzone.radius = spriteSize;
                break;
            case 'chunk':
                if(MapData.layers.chunk_display == 0) continue;
                markerX = MapData.view.convertX(marker.position.x, marker.position.z - marker.chunkSize / Config.coordScaleFac);
                markerY = MapData.view.convertY(marker.position.y, marker.position.z - marker.chunkSize / Config.coordScaleFac);
                tmp.topMarkerX = MapData.view.convertX(marker.position.x, marker.position.z + marker.chunkSize / Config.coordScaleFac);
                tmp.topMarkerY = MapData.view.convertY(marker.position.y, marker.position.z + marker.chunkSize / Config.coordScaleFac);
                spriteSize = (marker.chunkSize / Config.coordScaleFac) * MapData.view.scale * MapData.view.pixelRatio;

                if( Math.max(markerX, tmp.topMarkerX) + spriteSize < 0 ||
                    Math.min(markerX, tmp.topMarkerX) > mapCanvas.width ||
                    Math.max(markerY, tmp.topMarkerY) + spriteSize < 0 ||
                    Math.min(markerY, tmp.topMarkerY) > mapCanvas.height)
                        continue;
                
                marker.visible = true;
                if(!marker.tooltipHitzone) marker.tooltipHitzone = {};
                
                if(MapData.layers.chunk_display & 1){
                    marker.tooltipPosition.x = markerX / MapData.view.pixelRatio;
                    marker.tooltipPosition.y = markerY / MapData.view.pixelRatio;
                    marker.tooltipHitzone.offsetX = 0.5 * spriteSize;
                    marker.tooltipHitzone.offsetY = 0.5 * spriteSize;
                    marker.tooltipHitzone.width = spriteSize;
                    marker.tooltipHitzone.height = spriteSize;

                    mapctx.beginPath();
                    if(MapData.matrix.depth == 0) mapctx.fillStyle = Config.chunk_gradient[0].hex;
                    else mapctx.fillStyle = Color.blendGradient(Config.chunk_gradient, marker.position.z / MapData.matrix.depth).hex;
                    mapctx.strokeStyle = mapctx.fillStyle;
                    mapctx.lineWidth = 0.7;
                    if(MapData.layers.chunk_display & 4){
                        if(!marker.tooltipHitPoly) marker.tooltipHitPoly = [];
                        drawCube(marker.chunkBorderMin, marker.chunkBorderMax, MapData.layers.chunk_display & 2, marker);
                    }else{
                        marker.tooltipHitPoly = null;
                        mapctx.rect(
                            markerX,
                            markerY,
                            spriteSize,
                            spriteSize
                        );
                        if(MapData.layers.chunk_display & 2) mapctx.stroke();
                        else mapctx.fill();
                    }
                }
                if(MapData.layers.chunk_display & 2){
                    marker.tooltipHitzone.offsetX = 0;
                    marker.tooltipHitzone.offsetY = 0;
                    marker.tooltipHitzone.width = (marker.chunkBoundsSize.y / Config.coordScaleFac) * MapData.view.scale * MapData.view.pixelRatio;
                    marker.tooltipHitzone.height = (marker.chunkBoundsSize.x / Config.coordScaleFac) * MapData.view.scale * MapData.view.pixelRatio;

                    markerX = MapData.view.convertX(marker.chunkAveragePosition.y / Config.coordScaleFac, marker.chunkBoundsMax.z / Config.coordScaleFac);
                    markerY = MapData.view.convertY(marker.chunkAveragePosition.x / Config.coordScaleFac, marker.chunkBoundsMax.z / Config.coordScaleFac);
                    marker.tooltipPosition.x = markerX / MapData.view.pixelRatio;
                    marker.tooltipPosition.y = markerY / MapData.view.pixelRatio;
                    
                    mapctx.beginPath();
                    if(MapData.matrix.depth == 0) mapctx.fillStyle = Config.chunk_gradient[0].hex;
                    else mapctx.fillStyle = Color.blendGradient(Config.chunk_gradient, marker.position.z / MapData.matrix.depth).hex;
                    if(MapData.layers.chunk_display & 4){
                        if(!marker.tooltipHitPoly) marker.tooltipHitPoly = [];
                        drawCube(marker.chunkBoundsMin, marker.chunkBoundsMax, false, marker);
                    }else{
                        marker.tooltipHitPoly = null;
                        mapctx.rect(
                            markerX - marker.tooltipHitzone.width * 0.5,
                            markerY - marker.tooltipHitzone.height * 0.5,
                            marker.tooltipHitzone.width,
                            marker.tooltipHitzone.height
                        );
                        mapctx.fill();
                    }
                    marker.tooltipHitzone.width /= MapData.view.pixelRatio;
                    marker.tooltipHitzone.height /= MapData.view.pixelRatio;
                }
                if(marker.tooltipHitPoly){
                    for(let i=0; i<marker.tooltipHitPoly.length; i++){
                        marker.tooltipHitPoly[i] /= MapData.view.pixelRatio;
                    }
                }
                break;
            case 'component':
                if(!(MapData.layers.components)) break;
                if(!MapData.layers['component_'+marker.componentCategory]) break;
                if(!Utils.testOwner(MapData.searchFilter, marker.owner)) break;
                if(    marker.componentImpact == 0 && !(MapData.layers.impact_mask & 1)
                    || marker.componentImpact == 1 && !(MapData.layers.impact_mask & 2)
                    || marker.componentImpact == 2 && !(MapData.layers.impact_mask & 4)
                    || marker.componentImpact == 3 && !(MapData.layers.impact_mask & 8)
                ) break;
                marker.visible = true;
                markerCount++;
                Stats.addCountForUser(marker.owner.userId);
                spriteSize = Math.max(10, 0.10 * MapData.view.scale);
                if(MapData.layers.renderradii && marker.componentRadius && (
                       marker.componentImpact == 0 && MapData.layers.radius_impact_mask & 1
                    || marker.componentImpact == 1 && MapData.layers.radius_impact_mask & 2
                    || marker.componentImpact == 2 && MapData.layers.radius_impact_mask & 4
                    || marker.componentImpact == 3 && MapData.layers.radius_impact_mask & 8
                )){
                    mapctx.beginPath();
                    mapctx.moveTo(markerX, markerY);
                    mapctx.arc(
                        markerX,
                        markerY,
                        (Math.abs(marker.componentRadius) / Config.coordScaleFac) * MapData.view.scale * MapData.view.pixelRatio,
                        1,
                        3 * Math.PI
                    );
                    mapctx.strokeStyle = marker.componentRadius > 0 ? Config.colors.radius : Config.colors.radius_negative;
                    if(marker.componentImpact == 3) mapctx.lineWidth = 1.5;
                    else if(marker.componentImpact == 2) mapctx.lineWidth = 1.0;
                    else if(marker.componentImpact == 1) mapctx.lineWidth = 0.5;
                    else mapctx.lineWidth = 0.3;
                    mapctx.setLineDash([20, 5]);
                    mapctx.stroke();
                }
                mapctx.beginPath();
                mapctx.rect(
                    markerX - 0.5 * spriteSize,
                    markerY - 0.5 * spriteSize,
                    spriteSize,
                    spriteSize
                );
                if(marker.componentImpact == 3) mapctx.fillStyle = Config.colors.impact_high;
                else if(marker.componentImpact == 2) mapctx.fillStyle = Config.colors.impact_med;
                else if(marker.componentImpact == 0) mapctx.fillStyle = Config.colors.impact_none;
                else mapctx.fillStyle = Config.colors.impact_low;
                mapctx.strokeStyle = Config.colors.outline;
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
                Stats.addCountForUser(marker.owner.userId);
                mapctx.fillStyle = '#f0f';
                mapctx.strokeStyle = '#000';
                mapctx.beginPath();
                mapctx.arc(markerX, markerY, 5, 0, 2 * Math.PI);
                mapctx.stroke();
                mapctx.fill();
                if(!marker.tooltipHitzone) marker.tooltipHitzone = {};
                marker.tooltipHitzone.radius = 5;
                break;
        }
    }
    markerCountDisplay.innerHTML = markerCount + ' markers visible';
    if(Stats.show){
        let statsText = `${markerCount} markers visible<hr>`;
        for(let stat of Stats.getStats()){
            statsText += `<div>${stat.count} > <b>${stat.displayName}</b> (<a href="https://www.brickadia.com/users/${stat.userId}" title="${stat.userId}">${stat.userName}</a>)`;
        }
        statsPanel.innerHTML = statsText;
    }
    MapData.view.dirty = false;
}

function writeWarning(warning){
    warningPanel.style.display = 'block';
    warningPanel.innerHTML += warning + '<br>';
}