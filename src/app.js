/**
 * Pebble <3 BMW
 */

var UI = require('ui');
var ajax = require('ajax');
var Vector2 = require('vector2');

var app = {
  key: 'dib2015',
  vin: 'WBY1Z4C53EV273080',
  base_url: 'http://api.hackthedrive.com/vehicles/',
  vehicles: {},
  vin_order: [],
};

var main = new UI.Card({
  title: 'Pebble <3 BMW',
  subtitle: app.vin.substring(app.vin.length-4),
  action: {
    up: 'images/car_action_bar.png',
    down: 'images/start_action_bar.png',
  },
  banner: 'images/bmw_favicon.png',
});

main.show();
var vehicles_ready_if_zero = 2; // When this is 0, vehicles are ready to be shown.
// Start getting a location now.
navigator.geolocation.watchPosition(function(position){
  if (!app.position) {
    vehicles_ready_if_zero--;
  }
  app.position = {lat: position.coords.latitude, lon: position.coords.longitude};
}, function() {
  if (!app.position) {
    app.position = {lat: 37.77358, lon:-122.40336};
    vehicles_ready_if_zero--;
  }
}, {timeout: 3000});
// Now get all the vehicles and their locations.
ajax({url: app.base_url, type: 'json', method: 'get'}, function(cars) {
  vehicles_ready_if_zero--;
  vehicles_ready_if_zero += cars.length;
  cars.forEach(function(car) {
    ajax({url: app.base_url + car.vin + '/location/', type: 'json', method: 'get'}, function(loc) {
      app.vehicles[car.vin] = loc;
      vehicles_ready_if_zero--;
    });
  });
});

var score_locations = function() {
  for(var vin in app.vehicles) {
    if (!app.vehicles.hasOwnProperty(vin)) continue;
    var loc = app.vehicles[vin];
    loc.score = Math.pow(app.position.lat - loc.lat, 2) + Math.pow(app.position.lon - loc.lon, 2);
    loc.score = Math.sqrt(loc.score);
  }
  app.vin_order = Object.keys(app.vehicles);
  app.vin_order.sort(function(a, b){return app.vehicles[a].score - app.vehicles[b].score; });
};

main.on('click', 'up', function() {
  if (vehicles_ready_if_zero === 0) {
    score_locations();
    var items = [];
    app.vin_order.forEach(function(vin) {
      var loc = app.vehicles[vin];
      items.push({
        title: vin.substring(vin.length-4),
        subtitle: 'Distance: ' + Math.round(loc.score*60*5280) + ' ft',
        vin: vin,
      });
    });
    console.log(JSON.stringify(items));
    var menu = new UI.Menu({
      sections: [
        {
          title: 'Your cars',
          items: items,
        }
      ]
    });
    menu.on('select', function(e) {
      app.vin = e.item.vin;
      main.subtitle = app.vin.substring(app.vin.length-4);
      main.show();
      menu.hide();
    });
    menu.show();
  } else {
    var popup = new UI.Card({
      title: "Enumerating cars...",
    });
    popup.show();
  }
});


main.on('click', 'down', function(e) {
  var menu = new UI.Menu({
    sections: [{
      items: [{
        title: 'Lights',
        uri: 'lights',
        icon: 'images/light.png',
        extra: {count: 1},
        // icon: 'images/menu_icon.png',
      }, {
        title: 'Honk',
        uri: 'horn',
        icon: 'images/horn.png',
        extra: {key: app.key, count: 2},
      }, {
        title: 'Lock',
        uri: 'lock',
        icon: 'images/lock.png',
        extra: {key: app.key},
      }]
    }]
  });
  menu.on('select', function(e) {
    var url = 'http://api.hackthedrive.com/vehicles/' + app.vin + '/' + e.item.uri + '/';
    //console.log('Going to url: ' + url + ' with data: ' + JSON.stringify(e.item.extra));
    ajax({url: url, type: 'json', method: 'post', data:e.item.extra}, function(data) {
      console.log('success! ' + JSON.stringify(data));
    }, function(err) {
      console.log('error :( ' + JSON.stringify(err));
    });
  });
  menu.show();
});
