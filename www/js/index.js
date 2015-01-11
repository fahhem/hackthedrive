
var profile_names = {
    seat_back_pos: 'Seat back position',
    seat_height_pos: 'Seat height',
    seat_distance: 'Seat distance from front',
    seat_heat: 'Seat warmer intensity',
    ac_temp: 'AC temperature',
    ac_on: 'AC on',
    ac_fan_strength: 'AC fan intensity',
    ac_air_recycle: 'AC recycle air',
    window_down: 'Window down',
    moonroof_open: 'Moonroof open',
    steering_wheel_height: 'Steering wheel height',
};

var profiles = {
  a: {
    seat_back_pos: 3,
    seat_height_pos: 2,
    seat_distance: 5,
    seat_heat: 0,
    ac_temp: 70,
    ac_on: true,
    ac_fan_strength: 2,
    ac_air_recycle: true,
    window_down: true,
    moonroof_open: true,
    steering_wheel_height: 5,
  },
  b: {
    seat_back_pos: 2,
    seat_height_pos: 5,
    seat_distance: 2,
    seat_heat: 0,
    ac_temp: 75,
    ac_on: false,
    ac_fan_strength: 3,
    ac_air_recycle: false,
    window_down: false,
    moonroof_open: false,
    steering_wheel_height: 3,
  }
};

// var vins = [
//   'WBY1Z4C55EV273078',
//   'WBY1Z4C53EV273080',
//   'WBY1Z4C51EV275894',
//   'WBY1Z4C58EV275200',
// ];

var app = {
    initialize: function() {
        this.bindEvents();
    },
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },
    current_profile: null,
    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, we must explicitly call 'app.receivedEvent(...);'
    onDeviceReady: function() {
        // DO NOT USE this HERE!

        document.getElementById("shotgun").onclick = app.shotgun;
        document.getElementById("configure").onclick = app.configure;
        to_array(document.getElementsByName("profile")).forEach(function(el) {
          el.onclick = app.profile_change;
          if (el.checked) app.set_profile(el.value);
        });
        to_array(document.getElementsByClassName("back")).forEach(function(el) {
          el.onclick = app.back_to_main;
        });

        nfc.addTagDiscoveredListener (
            function (nfcEvent) {
                var tag = nfcEvent.tag;
                var id = tag.id;
                if (arraysEqual(id, [84, -36, -19, 4, 102, 36, 22, -32])) {
                  app.set_status("Driver");
                  return;
                } else {
                  alert('who?');
                }
            }, 
            function () {},
            function (error) { // error callback
                alert("Error adding NFC listener " + JSON.stringify(error));
            }
        );

        // Get default VIN
        var calls_left = 2;
        var maybe_call_choose = function() {
          calls_left--;
          if (calls_left == 0) app.choose_default_vin();
        }
        app.api_caller('get', false, false, null, function(resp) {
          // Need to make resp.data.length more calls after this.
          calls_left--;
          calls_left += resp.data.length;
          resp.data.forEach(function(car) {
            var vin = car.vin;
            app.api_caller('get', vin, 'location', null, function(resp) {
              app.vin_locations.push({lat: resp.data.lat, lon: resp.data.lon, vin: vin});
              maybe_call_choose();
            }, maybe_call_choose); // On error just skip.
          });
        });
        app.watcher = navigator.geolocation.watchPosition(function(position) {
          // if current_position is null, this is the first call.
          var is_first = !app.current_position;
          app.current_position = {
            lat: position.coords.latitude,
            lon: position.coords.longitude
          };
          console.log('got position: ' + JSON.stringify(app.current_position));
          if (is_first) maybe_call_choose();
          else {
            app.score_vin_locations();
          }
        }, function(error) {
          if (!app.current_position) {
            app.current_position = {lat: 37.77358, lon:-122.40336};
            maybe_call_choose();
          }
        }, {timeout: 3000});

    },
    set_status: function(status) {
      var prev = document.getElementById("user_status").innerHTML;
      document.getElementById("user_status").innerHTML = status;
      if (prev != status) {
        // honk the horn just to prove we can do it.
        // or flash the lights
        app.api_caller('post', app.vin, 'lights', {count: 1}, function(resp){
          console.log('LIGHTS ' + JSON.stringify(resp.data));
        });
      }
    },
    api_caller: function(method, vin, action, data, cb, errcb) {
      var url = 'http://api.hackthedrive.com/vehicles/';
      var errcb = errcb || function(err) {
        console.log('error');
        console.log(JSON.stringify(err));
      };
      var success = function(resp) {
        cb({status: resp.status, data: JSON.parse(resp.data)});
      };
      if (method == 'post') {
        cordovaHTTP.post(url + vin + (action?'/' + action:''),
            data, {"Content-Type": "application/json"}, success, errcb);
      } else if (method == 'get') {
        cordovaHTTP.get(url + (vin?vin + (action?'/' + action:''):''),
            {}, {}, success, errcb);
      }
    },
    vin: 'WBY1Z4C53EV273080', // 'WBY1Z4C55EV273078',
    current_position: null,
    // Ends up sorted closest-farthest.
    vin_locations: [],
    score_vin_locations: function(update_display) {
      var best_score = Number.MAX_VALUE;
      app.vin_locations.forEach(function(loc) {
        var score = Math.pow(app.current_position.lat - loc.lat, 2);
        score += Math.pow(app.current_position.lon - loc.lon, 2);
        score = Math.sqrt(score);
        loc.score = score;
        if (score < best_score) {
          best_score = score;
          app.vin = loc.vin;
        }
      });
      app.vin_locations.sort(function(a, b){return a.score - b.score;});
      // Update configure page if it's visible.
      var showing = document.getElementById('configure_section').style.display != 'none';
      if (update_display || showing) {
        var cars_html = '';
        app.vin_locations.forEach(function(loc) {
          cars_html += '<li><button onclick="app.choose_car(this)" data-vin="'
            + loc.vin + '" class="button">VIN: ' + loc.vin.substr(loc.vin.length-4)
            + (loc.score?' Distance: ' + Math.round(loc.score*60*5280) + ' ft':'')
            + '</button></li>';
        });
        document.getElementById('cars').innerHTML = cars_html;
      }
    },
    choose_default_vin: function() {
      app.score_vin_locations();
      app.set_vin(app.vin_locations[0].vin);
    },
    set_vin: function(vin) {
      app.vin = vin;
      document.getElementById('vin').innerHTML=vin.substr(vin.length-4);
    },
    shotgun: function() {
      app.set_status("Passenger");
    },
    configure: function() {
      app.score_vin_locations(true);
      document.getElementById('main').style.display = 'none';
      document.getElementById('configure_section').style.display = 'block';
      document.getElementById('store').onclick = function() {
        app.current_profile.ac_on = !app.current_profile.ac_on;
        app.current_profile.ac_temp++;
        app.set_profile(app.current_profile_name);
      };
    },
    choose_car: function(el) {
      app.set_vin(el.dataset.vin);
      app.back_to_main();
    },
    back_to_main: function() {
      document.getElementById('main').style.display = 'block';
      document.getElementById('configure_section').style.display = 'none';
    },
    set_profile: function(name) {
      app.current_profile_name = name;
      app.current_profile = profiles[name];
      var html = "";
      var keys = Object.keys(app.current_profile);
      keys.sort();
      // Swap ac_on to the top.
      keys[0] = keys.splice(keys.indexOf('ac_on'), 1, keys[0])[0];
      keys.forEach(function(key) {
        html += "<div>" + profile_names[key] + ": <span>"
          + app.current_profile[key] + "</span></div>";
      });
      document.getElementById("profile_info").innerHTML = html;
    },
    profile_change: function(ev) {
      app.set_profile(this.value);
      // alert('prof: ' + this.value);
    }
};

app.initialize();

function arraysEqual(a1,a2) {
    return JSON.stringify(a1)==JSON.stringify(a2);
}

function to_array(lst) {
  return Array.prototype.slice.call(lst);
}
