/*
 * Red Pitaya Template Application
 *
 *
 * (c) Red Pitaya  http://www.redpitaya.com
 */


(function(APP, $, undefined) {
    
    // App configuration
    APP.config = {};
    APP.config.app_id = 'multichannelanalyser';
    APP.config.app_url = '/bazaar?start=' + APP.config.app_id;
	APP.config.stop_url = '/bazaar?stop='+APP.config.app_id;
    APP.config.socket_url = 'ws://' + window.location.hostname + ':9002';

    // WebSocket
    APP.ws = null;




    // Starts template application on server
    APP.startApp = function() {

        $.get(APP.config.app_url)
            .done(function(dresult) {
                if (dresult.status == 'OK') {
					window.setTimeout(APP.connectWebSocket, 1000);
                } else if (dresult.status == 'ERROR') {
                    console.log(dresult.reason ? dresult.reason : 'Could not start the application (ERR1)');
                    APP.startApp();
                } else {
                    console.log('Could not start the application (ERR2)');
                    setTimeout(APP.startApp, 1000);
                }
            })
            .fail(function() {
                console.log('Could not start the application (ERR3)');
                setTimeout(APP.startApp, 1000);
            });
    };


    // Stop template application on server
    APP.stopApp = function() {

        $.ajax({
			type:"get",
			async: false,
			url: APP.stop_url,
			success: function(dresult) {
                if (dresult.status == 'OK') {
					return true;
                } else if (dresult.status == 'ERROR') {
                    console.log(dresult.reason ? dresult.reason : 'Could not stop the application (ERR4)');
                } else {
                    console.log('Could not stop the application (ERR5)');
                }
            },
			error: function() {
                console.log('Could not stop the application (ERR6)');
            }
		});
    };


    APP.connectWebSocket = function() {

        //Create WebSocket
        if (window.WebSocket) {
            APP.ws = new WebSocket(APP.config.socket_url);
            APP.ws.binaryType = "arraybuffer";
        } else if (window.MozWebSocket) {
            APP.ws = new MozWebSocket(APP.config.socket_url);
            APP.ws.binaryType = "arraybuffer";
        } else {
            console.log('Browser does not support WebSocket');
        }


        // Define WebSocket event listeners
        if (APP.ws) {

            APP.ws.onopen = function() {
                $('#hello_message').text("Hello, Red Pitaya!");
                console.log('Socket opened');               
            };

            APP.ws.onclose = function() {
                console.log('Socket closed');
            };

            APP.ws.onerror = function(ev) {
                $('#hello_message').text("Connection error");
                console.log('Websocket error: ', ev);         
            };

            APP.ws.onmessage = function(ev) {
                console.log('Message recieved');
            };
        }
    };


	APP.led_state = false;


	// program checks if led_state button was clicked
   	$('#led_state').click(function() {

        // changes local led state
        if (APP.led_state == true){
            $('#led_on').hide();
            $('#led_off').show();
            APP.led_state = false;
        }
        else{
            $('#led_off').hide();
            $('#led_on').show();
            APP.led_state = true;
        }

    	// sends current led state to backend
    	var local = {};
    	local['LED_STATE'] = { value: APP.led_state };
    	APP.ws.send(JSON.stringify({ parameters: local }));
	});

}(window.APP = window.APP || {}, jQuery));


// Page onload event handler
$(function() {
    // Start application
    APP.startApp();

	$(window).unload(function(){
		APP.startApp();
	});
});


