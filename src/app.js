/**
 * Pebble <3 BMW
 */

var UI = require('ui');
var ajax = require('ajax');

var app = {
  key: 'dib2015',
  vin: 'WBY1Z4C53EV273080',
  base_url: 'http://api.hackthedrive.com/vehicles/',
  position: null,
  position_listener: null,
  set_position: function(pos) {
    app.position = pos;
    if (app.position_listener)
      app.position_listener();
  },
  vehicles: {},
  vehicles_ready_if_zero: 0, // When this is 0, vehicles are ready to be shown.
  vehicles_listener: null,
  decrement_vehicles_ready: function() {
    app.vehicles_ready_if_zero--;
    if (app.vehicles_ready_if_zero === 0 && app.vehicles_listener) {
      app.vehicles_listener();
    }
  },
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
// Start getting a location now.
app.vehicles_ready_if_zero++;
navigator.geolocation.watchPosition(function(position){
  if (!app.position) {
    app.decrement_vehicles_ready();
  }
  app.set_position({lat: position.coords.latitude, lon: position.coords.longitude});
}, function() {
  if (!app.position) {
    app.set_position({lat: 37.77358, lon:-122.40336});
    app.decrement_vehicles_ready();
  }
}, {timeout: 3000});
// Now get all the vehicles and their locations.
app.vehicles_ready_if_zero++;
ajax({url: app.base_url, type: 'json', method: 'get'}, function(cars) {
  console.log("got " + cars.length + " cars");
  app.vehicles_ready_if_zero += cars.length;
  app.decrement_vehicles_ready();
  cars.forEach(function(car) {
    ajax({url: app.base_url + car.vin + '/location/', type: 'json', method: 'get'}, function(loc) {
      console.log("got a car: " + car.vin);
      app.vehicles[car.vin] = loc;
      app.decrement_vehicles_ready();
    }, app.decrement_vehicles_ready); // on error just skip it...
  });
}, app.decrement_vehicles_ready);

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

var show_cars = function() {
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
    main.subtitle(app.vin.substring(app.vin.length-4));
    main.show();
    menu.hide();
  });
  menu.show();
};

main.on('click', 'up', function() {
  if (app.vehicles_ready_if_zero === 0) {
    return show_cars();
  } 
  var popup = new UI.Card();
  var set_title = function() {
    popup.title(app.position ? "Enumerating cars..." : "Getting current location...");
  };
  set_title();
  app.position_listener = set_title;
  // if we get the vehicles, show them!
  app.vehicles_listener = function() {
    show_cars();
    // They shouldn't see this if they hit 'back'.
    popup.hide();
  };
  popup.on('click', 'back', function() {
    // cancel waiting
    app.vehicles_listener = null;
    app.position_listener = null;
  });
  popup.show();
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
        title: 'Horn',
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
    var response_card = new UI.Card({title: 'Toggling ' + e.item.title});
    response_card.show();
    ajax({url: url, type: 'json', method: 'post', data:e.item.extra}, function(data) {
      response_card.title('Toggled ' + e.item.title);
      setTimeout(function() {response_card.hide();}, 3000);
    }, function(err) {
      response_card.title('Failed to toggle ' + e.item.title);
      response_card.subtitle(JSON.stringify(err));
      setTimeout(function() {response_card.hide();}, 3000);
    });
    setTimeout(function() {response_card.hide();}, 10000);
  });
  menu.show();
});
