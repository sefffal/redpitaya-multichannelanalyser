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

    APP.status = APP.last_sent_status = 0;




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
                        APP.latestSignals = receive.signals;
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
        }, 750);

        APP._runLoop();

    };

    APP._runLoop = function() {

        // Update chart with latest values
        if (APP.latestSignals && APP.latestSignals.HISTOGRAM) {
            APP.updateChartData(APP.latestSignals.HISTOGRAM.value);
        }
        if (APP.latestSignals && APP.latestSignals.STATUS) {
            APP.status = APP.latestSignals.STATUS.value[APP.channel];
            APP.updateButtonStates();
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

    APP.resumeMCA = function(channel, timeleft_s) {

        // Set decimation to 16
        APP.setDecimation(channel, 16);
        
        // Send timer = (milliseconds*125000)

        // Send base update command 6, channel, type?
        APP.sendCommand(6, APP.channel, 0); // No baseline
        
        // Send base val command 7, channel, baseline
        APP.sendCommand(7, APP.channel, 0); // No baseline
        
        // Send PHA delay update command 8 channel 100?
        APP.sendCommand(8, APP.channel, 100);

        // Send thrs_update  command 9min, channel, min; command 10max channel max
        APP.sendCommand(9, APP.channel, 0);
        APP.sendCommand(10, APP.channel, 16380);

        // alert("Time: "+timeleft_s*125000+" "+timeleft_s);

        // counter setup
        APP.sendCommand(11, APP.channel, timeleft_s); // Set timer
        APP.sendCommand(0, APP.channel, 0); // Reset timer -- why are these different?

            // Send base update command 6, channel, type?
            APP.sendCommand(6, APP.channel, 0); // No baseline
            
            // Send base val command 7, channel, baseline
            APP.sendCommand(7, APP.channel, 0); // No baseline
            
            // Send PHA delay update command 8 channel 100?
            APP.sendCommand(8, APP.channel, 100);

            // Send thrs_update  command 9min, channel, min; command 10max channel max
            APP.sendCommand(9, APP.channel, 0);
            APP.sendCommand(10, APP.channel, 16380);

        // Send start command
        APP.sendCommand(12, APP.channel, 1);
    }
    APP.stopMCA = function(channel) {
        if (channel !== 0 && channel !== 1) {
            throw "Invalid Argument: Must have channel number 0 or 1";
        }
        APP.sendCommand(12, channel, 0);
    }
    APP.setDecimation = function(channel, decimation) {
        if (decimation<4) {
            throw "Decimation should porbably be at least 4";
        }
        APP.sendCommand(4, channel, decimation);
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
        // for (var i=0; i<16385; i++) {
        //     empty_data[i] = 0;
        // }

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
                    pointPlacement: 'on',
                    pointRange: 1,
                }
            },
            title: {
                text: '',
                enabled: false
            },
            xAxis: {
                crosshair: true,
                text: 'Channel Number',
                min: 0,
                max: 16385
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
        // for (var i=values.length-1; i>=0; i--) {
        //     if (values[i]===0) {
        //         logged_values[i] = 0;
        //     }
        //     else {
        //         logged_values[i] = Math.log10(values[i]);
        //     }
        // }
        for (var i=0, l=values.length; i<l; i++) {
            if (values[i]===0) {
            }
            else {
                logged_values.push([
                    i,
                    Math.log10(values[i])
                ]);
            }
        }
        APP.chart.series[0].setData(logged_values, true);//, true, true);
    }

    APP.updateButtonStates = function() {
        $('#hours, #minutes, #seconds').prop('disabled', false);

        if (APP.status != APP.last_sent_status) {
            $('#start').text('...');
            return;
        }

        // 0 : not started
        // 1 : running
        // 2 : stopped
        switch(APP.status) {
            case 0:
                $('#start').text('START');
                break
            case 1:
                $('#start').text('STOP');
                $('#hours, #minutes, #seconds').prop('disabled', true);
                break
            case 2:
                $('#start').text('RESUME');
                break
            default:
                $('#start').text('ERROR');
        }
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

        // Calculate the amount of time in milliseconds to run for
        var timeleft_s = Math.round(
            parseInt($('#hours'  ).val())*3600 +
            parseInt($('#minutes').val())*60 +
            parseInt($('#seconds').val())*1
        );

        if (timeleft_s > 2147483647) { // Max unsighed 32 bit value
            alert("That's too long. Pick a shorter time.");
            return;
        }

        if (APP.last_sent_status !== APP.status) {
            return false;
        }

        // 0 : not started
        // 1 : running
        // 2 : stopped
        switch(APP.status) {
            case 0:
                $('#start').text('...');
                APP.resumeMCA(APP.channel, timeleft_s);
                APP.last_sent_status = 1;
                break
            case 1:
                $('#start').text('...');
                APP.stopMCA(APP.channel);
                APP.last_sent_status = 2;
                break
            case 2:
                $('#start').text('...');
                APP.resumeMCA(APP.channel, timeleft_s);
                APP.last_sent_status = 1;
                break
            default:
                break
        }
    });

    $('#reset').click(function() {
        APP.resetHistogram(APP.channel);
    })
});


