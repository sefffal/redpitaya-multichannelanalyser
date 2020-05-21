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

    // 0 for IN1, 1 for IN2
    APP.channel = 0;

    // Status tracking
    APP.status = 0;
    APP.last_sent_status = null;

    // Channel settings
    APP.logarithmic = true;
    APP.decimation = [16,16];
    APP.bincount = 16384;
    APP.delay = [100,100];
    APP.baselineval = [0, 0];
    APP.baselineauto = [false, false];
    APP.threshold_min = [0, 0];
    APP.threshold_max = [16384, 16384];

    // Saved results
    APP.savedHistograms = [];

    APP.start_time = Date.now();

    // Starts template application on server
    APP.startApp = function() {
        APP.start_time = Date.now();   
        $('#loader').removeClass("error");        
        $('#hello_message.text').text('Connecting...');

        APP.createChart("Input 1 - Positive Pulses");

        $.get(APP.config.app_url)
            .done(function(dresult) {
                if (dresult.status == 'OK') {
					window.setTimeout(APP.connectWebSocket, 1000);
                } else if (dresult.status == 'ERROR') {
                    console.log(dresult.reason ? dresult.reason : 'Could not start the application (ERR1)');
                    $('.hello_message_text').html(dresult.reason ? dresult.reason : "Could not start the application (ERR1)."+
                    "<br><a onclick=\"APP.startApp()\">Retry?</a>");
                    $('#loader').addClass("error");
                } else {
                    console.log('Could not start the application (ERR2)');
                    $('.hello_message_text').html("Could not start the application (ERR2)."+
                    "<br><a onclick=\"APP.startApp()\">Retry?</a>");
                    $('#loader').addClass("error");
                }
            })
            .fail(function() {
                console.log('Could not start the application (ERR3)');
                $('.hello_message_text').html("Could not start the application (ERR3)."+
                    "<br><a onclick=\"APP.startApp()\">Retry?</a>");
                $('#hello_message').addClass("error");
            });
    };


    // Stop template application on server
    APP.stopApp = function(e) {

        APP.ws.close();

        $.ajax({
			type:"get",
			async: false,
			url: APP.config.stop_url,
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
                    e.preventDefault();
                    APP.stopApp = null;
                } else {
                    console.log('Could not stop the application (ERR5) -- ');
                    $('#loader').addClass("error");
                    $('#loader').removeClass("hidden");
                    $('#loader').removeClass("hide");
                    $('#hello_message').text('Could not stop the application (ERR5)');
                    $('#hello_message').addClass("error");
                    e.preventDefault();
                    APP.stopApp = null;
                }
            },
			error: function() {
                $('#loader').addClass("error");
                $('#loader').removeClass("hidden");
                $('#loader').removeClass("hide");
                $('#hello_message').text('Could not stop the application (ERR6)');
                $('#hello_message').addClass("error");
                console.log('Could not stop the application (ERR6)');
                e.preventDefault();
                APP.stopApp = null;
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
                //If it's been more than two seconds since we started the app,
                //then either the connection dropped or a user left the page
                //and hit "back". Try reconnecting.
                if (Date.now() - APP.start_time > 2000) {
                    APP.startApp()
                }
                else {
                    $('#hello_message_text').html(
                        "Connection error."+
                        "<br><a onclick=\"APP.startApp()\">Retry?</a>");
                    $('#hello_message').addClass("error");
                    console.log('Websocket error: ', ev);
                }
            };

            APP.ws.onmessage = function(ev) {
                try {
                    var data = new Uint8Array(ev.data);
                    var inflate = pako.inflate(data);
                    var text = String.fromCharCode.apply(null, new Uint8Array(inflate));
                    var receive = JSON.parse(text);

                    if (receive.parameters) {

                    }

                    if (receive.signals) {
                        if (APP.latestSignals && APP.latestSignals.STATUS && receive.signals.STATUS &&
                            APP.latestSignals.STATUS.value[APP.channel] === APP.last_sent_status &&
                            receive.signals.STATUS.value[APP.channel] !== APP.last_sent_status)
                        {
                            APP.last_sent_status = receive.signals.STATUS.value[APP.channel];
                        }

                        APP.latestSignals = receive.signals;
                    }

                } catch (e) {
                    console.log(e);
                }

            };
        }
    };


    APP._interval_timer = null;
    APP.startRunLoop = function() {

        if (APP._interval_timer) {
            clearInterval(APP._interval_timer);
        }
        APP._interval_timer = setInterval(function() {
            if (APP.channel < 0) {
                // Looking at imported data
                return;
            }
            // Trigger reading of histgoram for next time
            APP.readHistogram(APP.channel);
            APP.readTimer(APP.channel);
        }, 750);

        APP._runLoop();

    };

    APP._runLoop = function() {

        // Update chart with latest values
        if (APP.latestSignals && APP.latestSignals.HISTOGRAM && APP.channel >= 0) {
            APP.updateChartData(APP.latestSignals.HISTOGRAM.value);
            // // Upon receiving an update, we know the app is running so set start button text
            // $('#start').text("STOP");
        }

        // Update button states
        if (APP.channel >= 0) {
            if (APP.latestSignals && APP.latestSignals.STATUS) {
                APP.status = APP.latestSignals.STATUS.value[APP.channel];
                APP.updateButtonStates();
            }
        }
        else {
            APP.status = 3;
            APP.updateButtonStates();
        }

        // Update info
        if (APP.channel >= 0) {
            if (APP.latestSignals && APP.latestSignals.TIMER_CONFIG && APP.latestSignals.TIMER_STATUS) {
                APP.updateInfo(
                    APP.latestSignals.TIMER_STATUS.value[APP.channel],
                    APP.latestSignals.TIMER_CONFIG.value[APP.channel],
                    APP.latestSignals.HISTOGRAM.value
                );
            }
        } else {
            var val = parseInt($('#input select').val());
            APP.updateInfo(
                APP.savedHistograms[val-4].realtime,
                APP.savedHistograms[val-4].realtime,
                APP.savedHistograms[val-4].content
            );
        }


        // Run again
        setTimeout(APP._runLoop, 500);
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

        // // Send timer = (milliseconds*125000)

        // // Send base update command 6, channel, type?
        // APP.sendCommand(6, APP.channel, 0); // Reset to zero baseline

        // // Send base val command 7, channel, baseline
        // APP.sendCommand(7, APP.channel, 0); // baseline set to zero

        // // Send thrs_update  command 9min, channel, min; command 10max channel max
        // APP.sendCommand(9, APP.channel, 0);
        // APP.sendCommand(10, APP.channel, 16384);

        // // counter setup
        APP.sendCommand(11, APP.channel, timeleft_s); // Set timer
        APP.sendCommand(0, APP.channel, 0); // Reset timer -- why are these different?

        APP.setBaseline(APP.channel, APP.baselineval[APP.channel], APP.baselineauto[APP.channel]);

        // Send PHA delay update command 8 channel 100?
        APP.sendCommand(8, APP.channel, APP.delay[APP.channel]);

        // Set decimation to 16
        APP.setDecimation(channel, APP.decimation[channel]);

        APP.setThreshold(APP.channel, APP.threshold_min[APP.channel], APP.threshold_max[APP.channel])

        // Send PHA delay update command 8 channel 100?
        APP.setPHADelay(APP.channel, APP.delay[APP.channel]);


        // Send start command
        APP.sendCommand(12, APP.channel, 1);
    };
    APP.readTimer = function(channel) {
        if (channel !== 0 && channel !== 1) {
            throw "Invalid Argument: Must have channel number 0 or 1";
        }
        APP.sendCommand(13, channel, 0);
    };
    APP.stopMCA = function(channel) {
        if (channel !== 0 && channel !== 1) {
            throw "Invalid Argument: Must have channel number 0 or 1";
        }
        APP.sendCommand(12, channel, 0);
    };
    APP.setDecimation = function(channel, decimation) {
        if (decimation<4) {
            throw "Decimation should porbably be at least 4";
        }
        APP.sendCommand(4, channel, decimation);
    };
    APP.setBaseline = function(channel, val, auto) {

        // Send base update command 6, channel, type?
        APP.sendCommand(6, APP.channel, auto ? 1 : 0); // Auto baseline subtract

        // Send base val command 7, channel, baseline
        APP.sendCommand(7, APP.channel, val); 
    };
    // Sets if PHA should look for negative or positve pulses.
    // 1 means negative, 0 means positive.
    APP.setNegator = function(channel, negated) {
        if (channel !== 0 && channel !== 1) {
            throw "Invalid Argument: Must have channel number 0 or 1";
        }
        if (negated !== 0 && negated !== 1) {
            throw "Invalid Argument: Negated must be 0 or 1";
        }
        APP.sendCommand(5, channel, negated);
    };
    APP.readHistogram = function(channel) {
        if (channel !== 0 && channel !== 1) {
            throw "Invalid Argument: Must have channel number 0 or 1";
        }
        APP.sendCommand(14, channel, 0); // Read histogram
    };

    APP.resetHistogram = function(channel) {
        if (channel !== 0 && channel !== 1) {
            throw "Invalid Argument: Must have channel number 0 or 1";
        }
        APP.sendCommand(1, channel, 0); // Reset histogram
    };

    APP.setThreshold = function(channel, min, max) {
        if (channel !== 0 && channel !== 1) {
            throw "Invalid Argument: Must have channel number 0 or 1";
        }
        // Send thrs_update  command 9min, channel, min; command 10max channel max
        APP.sendCommand(9, APP.channel, min);
        APP.sendCommand(10, APP.channel, max);
    }
    APP.setPHADelay = function(channel, delay) {
        if (channel !== 0 && channel !== 1) {
            throw "Invalid Argument: Must have channel number 0 or 1";
        }
        if (delay < 0 || !(delay >= 0)) {
            throw "Invalid Argument: Delay must be a positive integer";
        }
        APP.sendCommand(8, channel, delay);
    }

    APP.createChart = function(title) {
        var empty_data = [[0,0]]
        // for (var i=0; i<16385; i++) {
        //     empty_data[i] = 0;
        // }

        var logLines = [];
        // TODO: yaxis log lines
        // for (var i=0; i<10; i++) {
        //     for (var j=0; j<10; j++) {

        //     }
        // }

        var log = APP.logarithmic;

        var plotBands = [];
        if ( APP.threshold_min[APP.channel] > 0) {
            plotBands.push({
                color: 'rgba(0,0,0, 0.25)',
                label: APP.threshold_min[APP.channel] > 130 ? {
                    text: 'Below threshold',
                    rotation: -90,
                    verticalAlign: 'middle',
                    align: 'right',
                    textAlign: 'center',
                    x: -5
                } : undefined,
                zIndex: 5,
                from: 0,
                to: APP.threshold_min[APP.channel]/16384*APP.bincount,
            });
        }
        if (APP.threshold_max[APP.channel] < 16384) {
            plotBands.push({
                color: 'rgba(0,0,0, 0.25)',
                label: APP.threshold_max[APP.channel] < 16384 - 130 ? {
                    text: 'Above threshold',
                    rotation: -90,
                    verticalAlign: 'middle',
                    align: 'left',
                    textAlign: 'center',
                    x: +10
                } : undefined,
                zIndex: 5,
                from: APP.threshold_max[APP.channel]/16384*APP.bincount,
                to: APP.bincount
            });
        }

        APP.chart = Highcharts.chart('histogram-container', {
            chart: {
                backgroundColor: 'transparent',
                zoomType: 'xy',
                type: 'column'
            },
            credits: {
                text: 'Pavel Demin & Will Thompson',
                position: {y: -10}
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
                    crisp: true // This distorts the widths of the bins a bit
                                // but prevents blurryness that makes it hard to
                                // read the chart
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
                max: APP.bincount,
                plotBands: plotBands
            },
            yAxis: {
                min: 0,
                softMax: log ? 3 :50,
                // maxPadding: 0.2,
                title: {
                    text: 'Counts'
                },
                tickInterval: log ? 1 : undefined,
                labels: {
                    formatter: log ?
                        function() {
                            return "1E"+this.value;
                        } :
                        function() {
                            return this.value;
                        }
                },
                plotLines: logLines
            },
            tooltip: {
                borderWidth: 1,
                borderColor: '#63A0DD',
                shadow: false,
                headerFormat: '',
                animation: false,
                pointFormatter: function() {
                    var counts = 0;
                    if (this.y>0) {
                        if (log) {
                            counts = Math.round(Math.pow(10, this.y));
                        }
                        else {
                            counts = this.y;
                        }
                    }
                    return "Channel "+this.x+": "+counts+" counts";
                },
                positioner: function(labelWidth, labelHeight, point) {
                    return {x:point.plotX, y:5}
                },
            },
            series: [
                {
                    name: title,
                    data: empty_data,
                    color: APP.channel === 1 ? '#61BC7B' : '#63A0DD'
                },
            ]
        });
    };

    APP.updateChartData = function(values) {
        if (!APP.chart) {
            return;
        }
        var new_values = [];
        // 16384 bins
        if (APP.bincount === 16384) {
            for (var i=0, l=values.length; i<l; i++) {
                if (values[i]===0) {
                }
                else {
                    new_values.push([
                        // Since a zero height pulse makes no sense, increase
                        // horizontal values by one.
                        i+1,
                        APP.logarithmic ? Math.log10(values[i]) : values[i]
                    ]);
                }
            }
        }
        // must re-bin
        else {
            var bin_total = 0;
            var ratio = Math.floor(16384/APP.bincount);
            for (var i=0, l=values.length; i<l; i++) {
                if (i%ratio===0) {
                    if (bin_total > 0) {
                        new_values.push([
                            Math.round(i/ratio),
                            APP.logarithmic ? Math.log10(bin_total) : bin_total
                        ]);
                        bin_total = 0;
                    }
                }
                bin_total += values[i];
            }
        }
        APP.chart.series[0].setData(new_values, true);//, true, true);
        // APP.chart.series[1].setData(error_bars, true);//, true, true);
    }

    APP.updateButtonStates = function() {

        // // Reset the UI when switching inputs or starting up
        // if (APP.last_sent_status === null) {
        //     APP.last_sent_status = status;
        // }

        // Blank out control button if still changing states
        if (APP.last_sent_status !== null && APP.status !== APP.last_sent_status) {
            $('#start').text('...');
                $('#hours, #minutes, #seconds').prop('disabled', true);
            return;
        }

        // 0 : not started
        // 1 : running
        // 2 : stopped
        switch(APP.status) {
            case 0:
                $('#start').text('START');
                $('#hours, #minutes, #seconds').prop('disabled', false);
                $('#start, #reset, #delay input, #decimation select, #export').prop('disabled', false);
                break
            case 1:
                $('#start').text('STOP');
                $('#hours, #minutes, #seconds').prop('disabled', true);
                $('#start, #reset, #delay input, #decimation select, #export').prop('disabled', false);
                break
            case 2:
                $('#start').text('RESTART');
                $('#hours, #minutes, #seconds').prop('disabled', false);
                $('#start, #reset, #delay input, #decimation select, #export').prop('disabled', false);
                break
            case 3:
                // Looking at imported file
                $('#start').text('START');
                $('#hours, #minutes, #seconds').prop('disabled', true);
                $('#start, #reset, #delay input, #decimation select, #export').prop('disabled', true);
                break;
            default:
                $('#start').text('ERROR');
                $('#hours, #minutes, #seconds').prop('disabled', false);
                $('#start, #reset, #delay input, #decimation select, #export').prop('disabled', false);
        }
    };


    APP.updateInfo = function(timer_status, timer_config, histogram) {
        $('#livetime').text(timer_status);

        var total = 0;
        for (var i=histogram.length-1; i>=0; i--) {
            total += histogram[i] || 0;
        }


        var region_of_interest = 0;
        if (APP.chart) {
            var zoom_data = APP.chart.xAxis[0].getExtremes();
            var start = Math.floor(zoom_data.min);
            var stop  = Math.ceil(zoom_data.max);
            var ratio = Math.floor(16384/APP.bincount);
            if (APP.bincount !== 16384) {
                start *= ratio;
                stop *= ratio;
            }
            for (var i=start; i<stop; i++) {
                region_of_interest += histogram[i];
            }
        }

        $('#total-counts .value').text(numberWithCommas(total));

        $('#region-of-interest .value').text(numberWithCommas(region_of_interest));

        if (APP.status != APP.last_sent_status) {
            $('#livetime-slider').val(false);
        }
        else if (timer_config > 0) {
            $('#livetime-slider').val(timer_status/timer_config*100);
        }
        else {
            $('#livetime-slider').val(0);
        }

        if (timer_status > 0) {
            $('#rate').text((total/timer_status).toExponential(2).toUpperCase());
        }

    }

    APP.exportCSV = function(filename) {

        var csv_content = "data:text/csv;charset=utf8,";
        var csv_list = [
            ["Real Time (s):", ""+APP.latestSignals.TIMER_STATUS.value[APP.channel]],
            ["Channel", "Counts"]
        ];
        for (var i=0, l=APP.latestSignals.HISTOGRAM.value.length; i<l; i++) {
            csv_list.push(
                i+", "+APP.latestSignals.HISTOGRAM.value[i]
            );
        }
        csv_content += csv_list.join("\n");

        var encodedUri = encodeURI(csv_content);
        var link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", filename+".csv");
        document.body.appendChild(link); // Required for FF

        link.click(); // This will download the data file named "my_data.csv".
        document.body.removeChild(link);
    };


    APP.showWarning = function(text) {
        $("#warning").css("visibility", "visible");
        $("#warning").text(text);;
    };

    APP.hideWarning = function() {
        $("#warning").css("visibility", "hidden");
    };

    APP.checkDecimationADCandBinCount = function() {
        if (APP.decimation[APP.channel] < 16 && APP.bincount > 1024) {
            APP.showWarning(
                "Warning: Decrease the bin-count or increase the sampling "+
                "window if using a STEMLAB-10 to avoid aliasing."
            );
        }
        else {
            APP.hideWarning();
        }
    };

    var filenum = 0;
    APP.importFile = function(file) {
        var reader = new FileReader();
        reader.onerror = function(error) {
            alert("Error reading file:\n"+JSON.stringify(error.target.error));
        };
        reader.onload = function(event) {
            var csv = event.target.result;
            var list_of_lines = csv.split(/\r\n|\n/);
            if (list_of_lines.length < 3) {
                alert("Please supply a CSV file in the same format as this app exports");
                return;
            }
            var time = parseInt(list_of_lines[0].split(/,|;|\t/)[1]);
            var results = [];
            var columns;
            for (var i=2, l=list_of_lines.length; i<l; i++) {
                columns = list_of_lines[i].split(/,|;|\t/);
                results[i-2] = parseInt(columns[1]);
            }
            var name = file.name.split('.')[0];
            APP.restoreData(name, results, time);
            // Load new data now
            $('#input select').val(4+filenum);
            $('#input select').trigger('change');
        }
        reader.readAsText(file);
    }

    APP.restoreData = function(name, results, time) {
        filenum++;
        var name = name || ("Import "+filenum);
        $('#input select').append($('<option>', {
            value: 4 + filenum,
            text: name
        }));
        APP.savedHistograms[filenum] = {
            name: name,
            content: results,
            realtime: time
        };
    };

    APP.redrawChart = function() {

        if (!APP.chart) {
            return;
        }
        var zoom_extremesx = APP.chart.xAxis[0].getExtremes();
        var zoom_extremesy = APP.chart.yAxis[0].getExtremes();
        var title = APP.chart.options.title.text;
        
        var val = parseInt($('#input select').val());
        if (val <=4 ) {
            var data = APP.latestSignals.HISTOGRAM.value;
        }
        else {
            var data = APP.savedHistograms[val-4].content;
        } 
        APP.chart.destroy();
        APP.createChart(title);
        APP.updateChartData(data);
        APP.chart.reflow();
        setTimeout(function() {
            APP.chart.xAxis[0].setExtremes(
                zoom_extremesx.min,
                zoom_extremesx.max,
                true, // Redraw
                false // Animation
            );
            APP.chart.yAxis[0].setExtremes(
                zoom_extremesy.min,
                zoom_extremesy.max,
                true, // Redraw
                false // Animation
            );
            if( !APP.chart.resetZoomButton ) {
                APP.chart.showResetZoom();
            }
        });
    };

    // Output a number with tousands separators.
    // From https://stackoverflow.com/questions/2901102/how-to-print-a-number-with-commas-as-thousands-separators-in-javascriptb
    function numberWithCommas(x) {
        return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

}(window.APP = window.APP || {}, jQuery));


// Page onload event handler
$(document).ready(function() {
    // Start application
    APP.startApp();

    // Set up tooltips
    $('.tooltip').tooltipster({
        theme: 'tooltipster-shadow',
        trigger: 'click',
        side: ['top', 'left', 'right', 'bottom']
    });

    // Stop application the way out
	$(window).bind('beforeunload', function(e){
		APP.stopApp(e);
	});


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

        if (APP.last_sent_status !== null && APP.last_sent_status !== APP.status) {
            return false;
        }

        // 0 : not started
        // 1 : running
        // 2 : stopped
        switch(APP.status) {
            case 0:
                APP.resumeMCA(APP.channel, timeleft_s);
                APP.last_sent_status = 1;
                break
            case 1:
                APP.stopMCA(APP.channel);
                APP.last_sent_status = 2;
                break
            case 2:
                APP.resumeMCA(APP.channel, timeleft_s);
                APP.last_sent_status = 1;
                break
            default:
                break
        }
        APP.updateButtonStates();
    });

    $('#reset').click(function() {
        APP.resetHistogram(APP.channel);
    });

    $('#export').click(function() {
        APP.exportCSV($('#input select option:selected').text());
    });

    $('#config').click(function() {
        $('#details-modal').addClass("show");

        var auto = APP.baselineauto[APP.channel];
        $('#baseline-val').val(APP.baselineval[APP.channel]);
        $('#baseline-val').prop('disabled', auto);
        $('#baseline-auto').prop('checked', auto);

        var min = APP.threshold_min[APP.channel];
        var max = APP.threshold_max[APP.channel];
        $('#threshold-min').val(min);
        $('#threshold-max').val(max);
    });

    $('.modal, #close-details').click(function(e) {

        // Do nothing if it was a child element that was clicked.
        if(e.target !== e.currentTarget) return;

        $('#details-modal').removeClass("show");
    });

    $('#input').on('change', function() {
        var val = parseInt($('#input select').val());

        // Regerate the chart completely
        APP.chart.destroy();

        switch(val) {
            case 1: // IN1-POS
                APP.channel = 0;
                APP.setNegator(APP.channel, 0);
                APP.createChart("Input 1 - Positive Pulses");
                break;
            case 2: // IN2-POS
                APP.channel = 1;
                APP.setNegator(APP.channel, 0);
                APP.createChart("Input 2 - Positive Pulses");
                break;
            case 3: // IN1-NEG
                APP.channel = 0;
                APP.setNegator(APP.channel, 1);
                APP.createChart("Input 1 - Negative Pulses");
                break;
            case 4: // IN2-NEG
                APP.channel = 1;
                APP.setNegator(APP.channel, 1);
                APP.createChart("Input 2 - Negative Pulses");
                break;
            default: // Imported file
                APP.channel = -1;
                APP.createChart(APP.savedHistograms[val-4].name);
                APP.updateChartData(
                    APP.savedHistograms[val-4].content
                );
                APP.updateInfo(
                    0,
                    0,
                    APP.savedHistograms[val-4].content
                );

        }

        APP.chart.reflow();

        // Update decimation dropdown to previousy known value
        if (APP.channel >= 0) {
            $('#decimation select').val(APP.decimation[APP.channel]);
            $('#delay input').val(APP.delay[APP.channel]);
            $('#delay #delay-readout').text(
                (APP.delay[APP.channel] * APP.decimation[APP.channel] * 8/1000).toFixed(1) + ' μs'
            );

            APP.checkDecimationADCandBinCount();
        }

        // Reset the UI state to unknown
        APP.last_sent_status = null;
    });

    $('#decimation select').on('change', function() {
        var val = parseInt($('#decimation option:selected').val());
        APP.decimation[APP.channel] = val;
        APP.setDecimation(APP.channel, val);
        // Update delay readout
        $('#delay #delay-readout').text(
            (APP.delay[APP.channel] * APP.decimation[APP.channel] * 8/1000).toFixed(1) + ' μs'
        );
        APP.checkDecimationADCandBinCount();
    });

    $('#delay input').on('change', function() {
        var val = parseInt($('#delay input').val());
        APP.delay[APP.channel] = val;
        APP.setPHADelay(APP.channel, APP.delay[APP.channel]);
        $('#delay #delay-readout').text(
            (APP.delay[APP.channel] * APP.decimation[APP.channel] * 8/1000).toFixed(1) + ' μs'
        );
        APP.checkDecimationADCandBinCount();
    });

    $('#baseline-val, #baseline-auto').on('change', function() {
        var val = parseInt($('#baseline-val').val());
        var auto = !!$('#baseline-auto').prop('checked');
        APP.baselineval[APP.channel] = val;
        APP.baselineauto[APP.channel] = auto;
        APP.setBaseline(APP.channel, val, auto);

        $('#baseline-val').prop('disabled', auto);
    });

    $('#threshold-min, #threshold-max').on('change', function() {
        var min = parseInt($('#threshold-min').val());
        var max = parseInt($('#threshold-max').val());
        APP.threshold_min[APP.channel] = min;
        APP.threshold_max[APP.channel] = max;

        APP.setThreshold(APP.channel, min, max);
        APP.redrawChart();
    });

    $('#bincount select').on('change', function() {
        var val = parseInt($('#bincount option:selected').val());
        APP.bincount = val;
        APP.checkDecimationADCandBinCount();
        $('#input select').trigger('change');
    });

    $('#importFileInput').on('change', function(event){
        if (this.files.length > 0 && window.FileReader) {
            for (var i=0, l=this.files.length; i<l; i++) {
                APP.importFile(this.files[i]);
            }
        }
    });

    $('#logarithmic input').on('change', function() {
        APP.logarithmic = $(this).is(":checked");
        $('#input').trigger('change');
    });

    // Highcharts don't handle css grids very well, so recreate chart on resize
    $(window).resize($.debounce(250, function() {
        console.log("Recreating chart (resize event)");
        APP.redrawChart();
    }));
});


