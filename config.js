'use strict';
import {Color} from './js/colorlib.js';
import {SpriteBounds} from './js/spritelib.js';

export const scrollZoomFactor = 1.25;
export const buttonZoomFactor = 1.5;

export const minZoomLevel = 0.01;
export const maxZoomLevel = 180;
export const defaultMapPadding = 500;

export const coordScaleFac = 100;

export const maxZoneLength = 700;

export const mapperVersion = 1;

/** How many pixels around the view is still considered "visible", beyond this and items are culled. */
export const viewCullMargin = 90;

export const tooltipHitzone = {
    default: {radius:12},
};

export const colors = {
    outline: '#000f',
    entity_awake: '#ff2c2cff',
    entity_asleep: '#2c7affff',
    entity_frozen: '#80ff2cff',
    chunk_low: '#4ba3d377',
    chunk_high: '#cae6f977',
    impact_none: '#28438caa',
    impact_low: '#81e883cc',
    impact_med: '#f4ae35dd',
    impact_high: '#f7004aee',
    radius: '#333388',
    radius_negative: '#ff3388',
}

export const spriteBounds = {
    unknown: new SpriteBounds(0,0,20,20),
    entity_awake: new SpriteBounds(0,20,20,20),
    entity_asleep: new SpriteBounds(20,20,20,20),
    entity_frozen: new SpriteBounds(40,20,20,20),
    impact_none: new SpriteBounds(0,40,20,20),
    impact_low: new SpriteBounds(20,40,20,20),
    impact_med: new SpriteBounds(40,40,20,20),
    impact_high: new SpriteBounds(60,40,20,20),
    player: new SpriteBounds(20,0,20,20),
}