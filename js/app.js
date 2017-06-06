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


    // Signal stack
    APP.latestSignals = {};

    // Parameters
    APP.processing = false;

    APP.channel = 0;




    // Starts template application on server
    APP.startApp = function() {
        $('#hello_message.text').text('Connecting...');

        APP.createChart();

        $.get(APP.config.app_url)
            .done(function(dresult) {
                if (dresult.status == 'OK') {
					window.setTimeout(APP.connectWebSocket, 1000);
                } else if (dresult.status == 'ERROR') {
                    console.log(dresult.reason ? dresult.reason : 'Could not start the application (ERR1)');
                    $('#hello_message_text').text(dresult.reason ? dresult.reason : 'Could not start the application (ERR1). Retrying in 1s...');
                    $('#loader').addClass("error");  
                    APP.startApp();
                } else {
                    console.log('Could not start the application (ERR2)');
                    $('#hello_message_text').text('Could not start the application (ERR2). Retrying in 1s...');
                    $('#loader').addClass("error");  
                    setTimeout(APP.startApp, 1000);
                }
            })
            .fail(function() {
                console.log('Could not start the application (ERR3)');
                $('#hello_message.text').text('Could not start the application (ERR3). Retrying in 1s...');
                $('#hello_message').addClass("error");  
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
                    $('#loader').addClass("error");   
                    $('#loader').removeClass("hidden");
                    $('#loader').removeClass("hide");
                    $('#hello_message').text(dresult.reason ? dresult.reason : 'Could not stop the application (ERR4)');
                    $('#hello_message').addClass("error");  
                } else {
                    console.log('Could not stop the application (ERR5)');
                    $('#loader').addClass("error");   
                    $('#loader').removeClass("hidden");
                    $('#loader').removeClass("hide");
                    $('#hello_message').text('Could not stop the application (ERR5)');
                    $('#hello_message').addClass("error");  
                }
            },
			error: function() {
                $('#loader').addClass("error");   
                $('#loader').removeClass("hidden");
                $('#loader').removeClass("hide");
                $('#hello_message').text('Could not stop the application (ERR6)');
                $('#hello_message').addClass("error");  
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
                $('#hello_message').text("Ready");
                $('#loader').addClass("hide");
                setTimeout(function(){
                    $('#loader').addClass("hidden"); 
                }, 250);
                console.log('Socket opened');
                APP.startRunLoop();
            };

            APP.ws.onclose = function() {
                console.log('Socket closed');
            };

            APP.ws.onerror = function(ev) {
                $('#hello_message').text("Connection error");
                $('#hello_message').addClass("error");    
                console.log('Websocket error: ', ev);
            };

            APP.ws.onmessage = function(ev) {

                //Capture signals
                if (APP.processing) {
                    return;
                }
                APP.processing = true;

                try {
                    var data = new Uint8Array(ev.data);
                    var inflate = pako.inflate(data);
                    var text = String.fromCharCode.apply(null, new Uint8Array(inflate));
                    var receive = JSON.parse(text);

                    if (receive.parameters) {
                        
                    }

                    if (receive.signals) {
                        APP.latestSignals = receive.signals
                    }
                    APP.processing = false;
                } catch (e) {
                    APP.processing = false;
                    console.log(e);
                } finally {
                    APP.processing = false;
                }


            };
        }
    };



    APP.startRunLoop = function() {

        setInterval(function() {
            // Trigger reading of histgoram for next time
            APP.readHistogram(APP.channel);
        }, 250);

    };

    APP._runLoop = function() {

        // Update chart with latest values
        if (APP.latestSignals && APP.latestSignals.HISTOGRAM) {
            APP.updateChartData(APP.latestSignals.HISTOGRAM.value);
        }

        // Run again
        setTimeout(APP.startRunLoop, 500);
    };

    APP.sendCommand = function(code, chan, data) {
        var msg = {
            parameters:{
                "COMMAND_CODE": {value: code},
                "COMMAND_CHAN": {value: chan},
                "COMMAND_DATA": {value: data},
            }
        }
        var serialized = JSON.stringify(msg);
        APP.ws.send(serialized);
    };

    APP.resumeMCA = function(channel) {
        APP.sendCommand(12, channel, 1);
    }
    APP.stopMCA = function(channel) {
        if (channel !== 0 && channel !== 1) {
            throw "Invalid Argument: Must have channel number 0 or 1";
        }
        APP.sendCommand(12, channel, 0);
    }

    APP.readHistogram = function(channel) {
        if (channel !== 0 && channel !== 1) {
            throw "Invalid Argument: Must have channel number 0 or 1";
        }
        APP.sendCommand(14, channel, 0); // Read histogram
    }

    APP.resetHistogram = function(channel) {
        if (channel !== 0 && channel !== 1) {
            throw "Invalid Argument: Must have channel number 0 or 1";
        }
        APP.sendCommand(1, channel, 0); // Reset histogram
    }

    APP.createChart = function() {
        var empty_data = []
        for (var i=0; i<16385; i++) {
            empty_data[i] = 0;
        }

        var logLines = [];
        // TODO: yaxis log lines
        // for (var i=0; i<10; i++) {
        //     for (var j=0; j<10; j++) {

        //     }
        // }

        APP.chart = Highcharts.chart('histogram-container', {
            chart: {
                type: 'column',
                // backgroundColor:'rgba(255, 255, 255, 0)',
                backgroundColor: 'transparent',
                zoomType: 'xy',
            },
            plotOptions: {
                column: {
                    animation: true,
                    shadow: false,
                    enableMouseTracking:true,
                    pointPadding: 0.0,
                    borderWidth: 0,
                    groupPadding: 0,
                    pointPlacement: 'between'
                }
            },
            title: {
                text: '',
                enabled: false
            },
            xAxis: {
                crosshair: true,
                text: 'Channel Number'
            },
            yAxis: {
                min: 0,
                // max: 1e10,
                max: 10,
                // type: 'logarithmic',
                title: {
                    text: 'Counts'
                },
                tickPositions: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                labels: {
                    formatter: function() {
                        return "1E"+this.value;
                    }
                },
                plotLines: logLines
            },
            tooltip: {
                borderWidth: 1,
                borderColor: '#63A0DD',
                shadow: false,
                pointFormatter: function() {
                    var counts = 0;
                    if (this.y>0) {
                        counts = Math.pow(10, this.y);
                    }
                    counts = Math.round(counts);
                    return "Channel "+this.x+": "+counts+" counts"; 
                },
                positioner: function(labelWidth, labelHeight, point) {
                    return {x:point.plotX, y:5}
                },
                // useHTML: true
            },
            series: [{
                name: 'Input 1',
                data: empty_data,
                color: '#63A0DD'
            }]
        });
    };

    APP.updateChartData = function(values) {
        if (!APP.chart) {
            return;
        }

        // Upon receiving an update, we know the app is running so set start button text
        $('#start').text("STOP");

        var logged_values = [];
        for (var i=values.length-1; i>=0; i--) {
            if (values[i]===0) {
                logged_values[i] = 0;
            }
            else {
                logged_values[i] = Math.log10(values[i]);
            }
        }
        APP.chart.series[0].setData(logged_values, true);//, true, true);
    }

}(window.APP = window.APP || {}, jQuery));


// Page onload event handler
$(function() {
    // Start application
    APP.startApp();

    // Stop application the way out
	// $(window).bind('beforeunload', function(){
	// 	APP.stopApp();
	// });

    $('#start').click(function() {
        if ($('#start').text() == 'START') {
            $('#start').text('...');
            APP.resumeMCA(APP.channel);
        }
        else {
            APP.stopMCA(APP.channel);
            $('#start').text('RESUME');
        }
    });

    $('#reset').click(function() {
        APP.resetHistogram(APP.channel);
    })
});


