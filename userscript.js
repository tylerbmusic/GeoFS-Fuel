// ==UserScript==
// @name         GeoFS Fuel
// @namespace    https://github.com/tylerbmusic/GeoFS-Fuel
// @version      0.1.3
// @description  Adds fuel to GeoFS (requested by many, made with some help from geofs_pilot)
// @author       GGamerGGuy
// @match        https://www.geo-fs.com/geofs.php?v=*
// @match        https://*.geo-fs.com/geofs.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=geo-fs.com
// @grant        none
// @downloadURL  https://github.com/tylerbmusic/GeoFS-Fuel/raw/refs/heads/main/userscript.js
// @updateURL    https://github.com/tylerbmusic/GeoFS-Fuel/raw/refs/heads/main/userscript.js
// ==/UserScript==

(function() {
    'use strict';
    window.fuel = {
        lastId: -1, //the aircraft's id as of the last tick
        gph: -1, //aircraft's gallons per hour
        capacity: -1, //aircraft's fuel capacity
        left: -1, //fuel left in the tank
        isRefueling: false, //whether or not the aircraft is refueling
        wasRefueling: false, //whether or not the aircraft was refueling as of the last tick
        refuelAmount: -1, //how much to refuel the aircraft to
        refuelTime: 1, //how long refueling should take, in minutes
        refuelPerSec: -1, //how much per second to refuel the aircraft to be able to fuel it in the given time
        nextTick: -1,
        firstAudio: new Audio("https://tylerbmusic.github.io/GPWS-files_geofs/fuelNotify.wav"),
    };
    window.GAL_TO_LITERS = 3.78541;

    //Addon menu code
    if (!window.gmenu || !window.GMenu) {
        fetch(
            "https://raw.githubusercontent.com/tylerbmusic/GeoFS-Addon-Menu/refs/heads/main/addonMenu.js"
        )
            .then((response) => response.text())
            .then((script) => {
            eval(script);
        })
            .then(() => {
            setTimeout(afterGMenu, 100);
        });
    } else afterGMenu()
    //Code to be executed once the addon menu code is loaded
    async function afterGMenu() {
        var isMetric = "true";
        fetch('https://freeipapi.com/api/json')
            .then(response => response.json())
            .then(data => {
            const country = data.countryCode;
            console.log("Country Code:", country);
            if (country == 'US' || country == 'LR' || country == 'MM') { //US=United States, LR=Liberia, MM=Myanmar
                isMetric = "false";
            }
        });
        console.log(isMetric);
        const m = new window.GMenu("Fuel", "fuel");
        m.addItem("Fuel low warning threshold %: ", "Threshold", "number", 0, "0.15", 'min=0 max=1 step=0.01');
        m.addItem("Refuel Amount (gal/liters): ", "Amount", "number", 0, "0", `min=0`);
        m.addItem("Refuel Time (minutes): ", "Time", "number", 0, "1", 'min=0 step=0.1');
        m.addItem("Allow midair refueling: ", "AirRefuel", "checkbox", 0, "false");
        m.addItem("Use metric system: ", "Metric", "checkbox", 0, isMetric);
        window.fuel.refuel = function() {
            window.fuel.refuelAmount = Math.min(Number(localStorage.getItem("fuelAmount")), window.fuel.capacity);
            window.fuel.refuelTime = Number(localStorage.getItem("fuelTime"));
            window.fuel.refuelPerSec = (window.fuel.refuelAmount - window.fuel.left)/(window.fuel.refuelTime*60);
            window.fuel.isRefueling = true;
            console.log("Refueling...");
        };
        m.addButton("REFUEL", window.fuel.refuel, 'onclick="window.fuel.refuel()"');
        let a = document.getElementsByClassName("geofs-alarms-container")[0];
        a.innerHTML += `<div class="geofs-inline-overlay geofs-textOverlay control-pad-transparent orange-pad control-pad-dyn-label geofs-hidden" style="background-size: 100px 25px; margin-left: 0px; margin-bottom: 0px; z-index: 60; background-position: 0px 0px; width: 100px; height: 25px; transform-origin: 0px 25px; opacity: 1; transform: rotate(0deg);" id="lowfuel">LOW FUEL</div>`;
        fWait();
    }
})();

//Wait for GeoFS to finish loading in everything before trying to get any values, to avoid errors
function fWait() {
    if (window.geofs.cautiousWithTerrain == false && window.geofs.aircraft.instance && window.geofs.animation) {
        setTimeout(() => {
            window.fuelInit();
        }, 3000);
    } else {
        setTimeout(() => {
            fWait();
        }, 1000);
    }
};
//Initialize the fuel display (you can find it in the bottom right)
window.fuelInit = function() {
    setTimeout(() => {
        window.fuel.nextTick = Date.now()+1000;
        window.fuelTick();
    }, 3000);
    // Display css
    var flightDataElement = document.getElementById('flightDataDisplay10');
    if (!flightDataElement) {
        flightDataElement = document.createElement('div');
        flightDataElement.id = 'flightDataDisplay10';
        flightDataElement.style.position = 'fixed';
        flightDataElement.style.bottom = '0';
        flightDataElement.style.right = 'calc(10px + 48px + 16px)';
        flightDataElement.style.height = '36px';
        flightDataElement.style.minWidth = '64px';
        flightDataElement.style.padding = '0 16px';
        flightDataElement.style.display = 'inline-block';
        flightDataElement.style.fontFamily = '"Roboto", "Helvetica", "Arial", sans-serif';
        flightDataElement.style.fontSize = '14px';
        flightDataElement.style.textTransform = 'uppercase';
        flightDataElement.style.overflow = 'hidden';
        flightDataElement.style.willChange = 'box-shadow';
        flightDataElement.style.transition = 'box-shadow .2s cubic-bezier(.4,0,1,1), background-color .2s cubic-bezier(.4,0,.2,1), color .2s cubic-bezier(.4,0,.2,1)';
        flightDataElement.style.textAlign = 'center';
        flightDataElement.style.lineHeight = '36px';
        flightDataElement.style.verticalAlign = 'middle';
        flightDataElement.style.zIndex = '9999';
        document.body.appendChild(flightDataElement);
    }
    var afuelGauge = document.createElement('div');
    afuelGauge.id = 'afuelGauge';
    afuelGauge.style.width = '50px';
    afuelGauge.style.height = '50px';
    //afuelGauge.style.right = '-25px';
    //afuelGauge.style.bottom = '160px';
    //afuelGauge.style.position = 'absolute';
    afuelGauge.style.borderRadius = '50%';
    //afuelGauge.style.scale = '0.5';
    afuelGauge.style.cursor = 'default !important';
    afuelGauge.className = "geofs-inline-overlay geofs-textOverlay control-pad geofs-manipulator geofs-visible";
    document.getElementsByClassName("geofs-pads-container")[0].prepend(afuelGauge);
    afuelGauge.innerHTML = `<div id="fuelGauge" style="background-image: url(https://tylerbmusic.github.io/GPWS-files_geofs/fuel_meter.png);width: 50px;height: 50px;background-size: 100%;position: absolute;top: 0;"></div>
    <div id="fuelHandle" style="background-image: url(https://tylerbmusic.github.io/GPWS-files_geofs/fuel_handle.png);background-size: 100%;width: 50px;height: 50px;position: absolute;top: 0;transform-origin: 24.5px 33.75px;"></div>`;
    if (!localStorage.getItem("fuelFirstTime")) {
        localStorage.setItem("fuelFirstTime", "false");
        window.fuel.firstAudio.play();
    }

    flightDataElement.innerHTML = `
                <span style="background: 0 0; border: none; border-radius: 2px; color: #000; display: inline-block; padding: 0 8px;" id="fuelL">FUEL LEFT:  ${Math.round(100*(window.fuel.left/window.fuel.capacity))}%</span>
            `;
}
//A function to be run every second
window.fuelTick = function() {
    const FUEL_DENSITY = 300; // Denisty of ATF Fuel in kg/m^3
    const GRAVITY = 9.81; // in m/s^2

    if (localStorage.getItem("fuelEnabled") == "true" && (Date.now() >= window.fuel.nextTick)) {
        window.fuel.nextTick += 1000;

        var lowAlarm = document.getElementById("lowfuel") || null;
        if (window.fuel.lastId != Number(window.geofs.aircraft.instance.id)) { //On aircraft change
            window.fuel.lastId = Number(window.geofs.aircraft.instance.id);
            let s = window.fuel.getStats(window.fuel.lastId);
            window.fuel.gph = s[0];
            window.fuel.capacity = s[1];
            window.fuel.left = (window.fuel.capacity > 0) ? window.fuel.capacity / 2 : -1;
            window.fuel.isRefueling = false;
            document.getElementById("fuelAmount").max = window.fuel.capacity;
        }

        if (window.fuel.capacity > 0 && lowAlarm) {
            document.getElementById('flightDataDisplay10').innerHTML = `
                <span style="background: 0 0; border: none; border-radius: 2px; color: #000; display: inline-block; padding: 0 8px;">FUEL LEFT: ${Math.round(window.fuel.left)}/${Math.round(window.fuel.capacity)} ${(localStorage.getItem("fuelMetric") == "true") ? 'L' : 'GAL'} (${Math.round(100*(window.fuel.left/window.fuel.capacity))}%)</span>
            `;
            document.getElementById('fuelHandle').style.transform = 'rotate(' + Math.round(((84*(window.fuel.left/window.fuel.capacity)-42)%360)*1000)/1000 + 'deg)';

            if (window.fuel.left > 0) {
                window.fuel.left -= (window.geofs.aircraft.instance.engine.on && !window.geofs.isPaused() && window/*TODO*/) ? (window.fuel.gph / 3600)*((1/1.1)*Math.abs(window.geofs.animation.values.smoothThrottle+0.1)) : 0;
                window.fuel.left -= (window.geofs.animation.values.smoothThrottle > 0.9 && window.geofs.aircraft.instance.engines[0].afterBurnerThrust && window.geofs.aircraft.instance.engine.on && !window.geofs.isPaused()) ? ((window.fuel.gph*2) / 3600)*((1/1.1)*Math.abs(window.geofs.animation.values.smoothThrottle+0.1)) : 0; //According to Google, afterburners burn up to 3 times more fuel than normal flight
                
                // Sub routine to change Aircraft weight according to fuel left
                window.geofs.aircraft.instance.rigidBody.gravityForce[2] = -(window.geofs.aircraft.instance.rigidBody.mass * GRAVITY + window.fuel.left * (FUEL_DENSITY / 1000) * GRAVITY);
                
                let a = lowAlarm.className.split(" ");
                if ((window.fuel.left / window.fuel.capacity <= Number(localStorage.getItem("fuelThreshold"))) && a[5] == "geofs-hidden") {
                    a[5] = "geofs-visible";
                    lowAlarm.className = a.join(" ");
                } else if (a[5] == "geofs-visible") {
                    a[5] = "geofs-hidden";
                    lowAlarm.className = a.join(" ");
                }
            } else {
                window.geofs.aircraft.instance.stopEngine();
                window.controls.throttle = 0;
            }
        }

        if (window.fuel.isRefueling) {
            if ((Math.round(window.fuel.left*100)/100 != Math.round(window.fuel.refuelAmount*100)/100) && ((window.geofs.animation.values.groundContact && !window.geofs.aircraft.instance.engine.on && (window.geofs.animation.values.groundSpeed < 2)) || localStorage.getItem("fuelAirRefuel") == 'true')) {
                if (window.fuel.refuelPerSec > 0 && window.fuel.left >= window.fuel.refuelAmount) {
                    window.fuel.isRefueling = false;
                    window.fuel.left = window.fuel.refuelAmount; //Sometimes the fuel overfills lol
                    console.log("Stopped refueling");
                } else if (window.fuel.refuelPerSec < 0 && window.fuel.left <= window.fuel.refuelAmount) {
                    window.fuel.isRefueling = false;
                    window.fuel.left = window.fuel.refuelAmount; //Sometimes the fuel overfills lol
                    console.log("Stopped defueling");
                }
                window.fuel.left += window.fuel.refuelPerSec;
            } else if (!(window.geofs.animation.values.groundContact && !window.geofs.aircraft.instance.engine.on && (window.geofs.animation.values.groundSpeed < 2))) {
                window.fuel.isRefueling = false;
                alert("In order to refuel, you must be on the ground, your engines must be off, and you must be still");
            } else {
                window.fuel.isRefueling = false;
            }
        }
    }
    setTimeout(window.fuelTick, 10);
}

//@returns [gph, capacity]
window.fuel.getStats = function(id) {
    var ret;
    switch (id) {
        case 1:
            ret = [5,12];
            break;
        case 2:
            ret = [9,56];
            break;
        case 3:
            ret = [225,502];
            break;
        case 4:
            ret = [693,5152];
            break;
        case 5:
            ret = [125, 419];
            break;
        case 6:
            ret = [86,378];
            break;
        case 7:
            ret = [8000,7000]; //These are in pounds per hour for now
            break;
        case 8:
            ret = [13,35];
            break;
        case 9:
            ret = [75,189];
            break;
        case 10:
            ret = [4600,84600];
            break;
        case 11:
            ret = [4.3,22]; //These are in kW & kWh for now
            break;
        case 12:
            ret = [69,63];
            break;
        case 13:
            ret = [28,175];
            break;
        case 14:
            ret = [16,8];
            break;
        case 15:
            ret = [120,1162];
            break;
        case 16:
            ret = [245,822];
            break;
        case 18:
            ret = [291,3791];
            break;
        case 20:
            ret = [6771,31569];
            break;
        case 21:
            ret = [8,16];
            break;
        case 22:
            ret = [5.5,26];
            break;
        case 23:
            ret = [10,48];
            break;
        case 24:
            ret = [2400,37200];
            break;
        case 25:
            ret = [3216,45220];
            break;
        case 26:
            ret = [100,1442];
            break;
        case 27:
            ret = [1000,2060];
            break;
        case 28:
            ret = [27, 116];
            break;
        case 31:
            ret = [17,422];
            break;
        case 40:
            ret = [5,17];
            break;
        default:
            ret = [-1, -1];
            break;
    }
    if ((localStorage.getItem("fuelMetric") == 'false')) {
        return ret;
    } else {
        for (let i in ret) {
            ret[i] = ret[i]*window.GAL_TO_LITERS;
        }
        return ret;
    }
}
