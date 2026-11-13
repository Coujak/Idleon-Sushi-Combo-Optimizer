import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");

test("Production metrics lead the Account dashboard without moving import controls",()=>{
 const overview=html.indexOf('id="lab-overview"');
 const importPanel=html.indexOf('id="importPanel"',overview);
 const dashboardHeading=html.indexOf('<h2>Account dashboard</h2>',overview);
 const production=html.indexOf('class="lab-dashboard-section lab-dashboard-production"',dashboardHeading);
 const productionStats=html.indexOf('id="labProductionStats"',production);
 const progression=html.indexOf('id="labAccountProgressTitle"',production);
 const accountStats=html.indexOf('id="labOverviewStats"',progression);
 const shakers=html.indexOf('id="labShakerTitle"',accountStats);
 assert.ok(overview>=0&&importPanel>overview&&dashboardHeading>importPanel);
 assert.ok(dashboardHeading<production&&production<productionStats);
 assert.ok(productionStats<progression&&progression<accountStats&&accountStats<shakers);
 assert.equal(html.split('id="labOverviewStats"').length-1,1);
 assert.equal(html.split('id="labProductionStats"').length-1,1);
});

test("Production panel is visually distinct but retains legible responsive cards",()=>{
 assert.match(css,/--production-accent:#c5b6ff/);
 assert.match(css,/#lab-overview \.lab-welcome-panel > \.lab-dashboard-production\{/);
 assert.match(css,/background:linear-gradient\(128deg,#27233e/);
 assert.match(css,/#lab-overview \.lab-dashboard-production \.lab-production-stats\{/);
 assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:1150px\)/);
 assert.match(css,/@media\(max-width:740px\)/);
 assert.match(css,/@media\(max-width:360px\)/);
 assert.match(css,/#lab-overview \.lab-dashboard-progress \.lab-dashboard-section-heading/);
});
