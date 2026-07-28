// src/assets/au-states.ts
// Approximate SVG path data for Australian states/territories
// Paths are rough polygons scaled to a 500x500 viewBox — not cartographically precise,
// but distinct and labelled so the choropleth renders clearly.
// ViewBox: 0 0 500 500 (W=right, N=up → Y inverted so S=down)

export interface StateShape {
  d: string;
  label: string;
  cx: number; // label centre x
  cy: number; // label centre y
}

export const AU_STATES: Record<string, StateShape> = {
  "Western Australia": {
    d: "M 30 60 L 175 60 L 175 200 L 155 240 L 175 270 L 175 420 L 30 420 Z",
    label: "WA",
    cx: 100,
    cy: 240,
  },
  "Northern Territory": {
    d: "M 175 60 L 295 60 L 295 240 L 255 240 L 255 270 L 175 270 L 175 240 L 155 240 L 175 200 L 175 60 Z",
    label: "NT",
    cx: 235,
    cy: 155,
  },
  "South Australia": {
    d: "M 175 270 L 255 270 L 255 240 L 295 240 L 295 370 L 260 370 L 260 420 L 175 420 L 175 270 Z",
    label: "SA",
    cx: 230,
    cy: 340,
  },
  "Queensland": {
    d: "M 295 60 L 430 60 L 430 240 L 360 290 L 295 290 L 295 240 L 295 60 Z",
    label: "QLD",
    cx: 362,
    cy: 165,
  },
  "New South Wales": {
    d: "M 295 290 L 360 290 L 430 240 L 465 300 L 400 370 L 295 370 L 295 290 Z",
    label: "NSW",
    cx: 375,
    cy: 325,
  },
  "Victoria": {
    d: "M 295 370 L 400 370 L 440 420 L 295 420 L 295 370 Z",
    label: "VIC",
    cx: 365,
    cy: 400,
  },
  "Tasmania": {
    d: "M 360 435 L 415 435 L 415 480 L 360 480 Z",
    label: "TAS",
    cx: 387,
    cy: 457,
  },
  "Australian Capital Territory": {
    d: "M 375 360 L 400 360 L 400 375 L 375 375 Z",
    label: "ACT",
    cx: 387,
    cy: 367,
  },
};
