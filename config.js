'use strict';
import {Color} from './js/colorlib.js';
import {SpriteBounds} from './js/spritelib.js';

export const gradeColors = {
    grade_flat: '#fff',
    grade_0: '#f4f7cd',
    grade_1: '#f8ff99',
    grade_2: '#edfc1b',
    grade_3: '#fcb520',
    grade_4: '#f07837',
    grade_5: '#e66441',
    grade_6: '#ce3f57',
    grade_7: '#c33577',
    grade_8: '#a3008d',
    grade_9: '#690097',
}

export const speedGradient = [
    new Color('#370065'),
    new Color('#79146e'),
    new Color('#d53354'),
    new Color('#fa8256'),
    new Color('#fbffb2'),
]

export const altitudeGradient = [
    new Color('#340042'),
    new Color('#235f7b'),
    new Color('#51c34e'),
    new Color('#fce51e'),
]

export const sidingUsageMeanings = {
    I:'Inbound',
    O:'Outbound',
    L:'Loading',
    P:'Locomotive Parking',
    S:'Car Storage',
    LP:'Passenger Transfer',
    SP:'Passenger Car Storage',
    D:'Service & Repair',
}

export const bezierGradeResolution = 80;
export const bezierLengthResolution = 80;
export const bezierCurvatureResolution = 80;
export const scrollZoomFactor = 1.25;
export const buttonZoomFactor = 1.5;

export const minZoomLevel = 0.01;
export const maxZoomLevel = 180;
export const defaultMapPadding = 500;

export const coordScaleFac = 100;

export const maxZoneLength = 700;

/** How many pixels around the view is still considered "visible", beyond this and items are culled. */
export const viewCullMargin = 90;

export const tooltipHitzone = {
    default: {radius:12},
    junction: {width:24, height:35},
};

export const spriteBounds = {
    unknown: new SpriteBounds(0,0,20,20),
    entity_awake: new SpriteBounds(0,20,20,20),
    entity_asleep: new SpriteBounds(20,20,20,20),
    entity_frozen: new SpriteBounds(40,20,20,20),
    player: new SpriteBounds(20,0,20,20),
}