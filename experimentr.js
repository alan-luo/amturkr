//pretty much entirely rewritten
/*
differences: 
- 'data' variable restructured to only include user-added data 
    (tracking stuff is automatically included)
- redone using jquery instead of d3 - technically arbitrary, but jQuery is more universal
- added a number of usability features
    can attach scripts from init
    reworked next button functionality because it was annoying
        can now add next/finish/start buttons, postid from html
    made module system more flexible (attach modules to a parent)
    can start from a certain module (for debugging purposes)
- added mouse position + click tracking

TODO
- add more custom ajax / save support (CSV in particular...)
- add custom demographic / consent / comments / etc form support
    automatic validation
    generation of default pages using basic parameters
        experimentr.createModule...
- add a countdown handler
- enable multiple callbacks per module

TODO later
- allow modules to be created inline as well as scripts
- allow multiple modules to one file
- figure out how to get rid of __GlobalExperiment
*/

/*notes: possible conflict with D3, commonly used in turk studies, as they both control the DOM
I don't think this should be an issue, as I don't see why they would clash. Also,
http://collaboradev.com/2014/03/18/d3-and-jquery-interoperability/
... suggests that they should work fine.
However, the jquery parts can easily be rewritten for d3.

*/


//experimentr v0.2						 dependencies: jquery

//Experiment prototype - initialize one of these to start an experiment
function Experiment() {
    //initialize a couple of variables to use later in the object
    this.data = {}; //subject data
    this.parent = $("body"); //parent for module appending
    this.index = -1; //current module (-1 means hasn't started yet)
    this.tracking = {mouseData: false, moduleTime:false, experimentTime:true}; //tracking parameters
    this.handlers = {}; //handlers added through init rather than through html
    this.trackedTimes = {}; //tracked timing data
    this.positionlist = []; this.clicklist = []; //list of modules to do mouse tracking on
    this.trackedClicks = {}; this.trackedPositions = {}; //tracked mouse data
    this.clickSelectors = []; //jquery selector for element listening
    this.verboseLevel = 0;


    this.setVerboseLevel = function(input) {
        if(input == 'verbose' || input == 'v' || input == 1) {
            this.verboseLevel = 1;
            console.log("set verbose level to "+this.verboseLevel);
        } else if(input <= 0 || input == 'quiet' || input == '') {
            this.verboseLevel = 0;
        } else if(input > 1 || input == 'V' || input == 'very') {
            this.verboseLevel = 2;
            console.log("set verbose level to "+this.verboseLevel);
        } else {
            throw 'Invalid verbose level.';
        }
    };
    //attach the modules to a parent using a jquery selector
    this.attach = function(input) {
        var domobject;
        if(typeof input == "string") { //use (jquery object).get(0) to get DOM object
            domobject = $(input).first();
        } else {
            throw 'Invalid selector.';
        }

        this.parent = domobject;
    };
    //set the module sequence
    this.setSequence = function() {
        var args = Array.prototype.slice.call(arguments, 0);
        var newargs = [];
        for(var i=0; i<args.length; i++) {
            newargs.push(experimentr.getModuleString(args[i]));
        }
        this.sequence = newargs;
    };
    function merge(o1, o2) { // merges o1 and o2
        for (var attr in o2) { o1[attr] = o2[attr]; }
    };
    //add subject data
    this.addData = function(d) {
        this.logv("adding data: "+JSON.stringify(d));
        merge(this.data, d);
    };
    //start the experiment
    this.start = function() {
        this.logv("starting experiment");
        if(this.tracking.experimentTime) {
            this.trackedTimes.startTime = Date.now();
            this.logv("experiment starting at "+this.trackedTimes.startTime);
        }
        if(this.tracking.moduleTime) {
            this.logv("initializing module time tracking");
            this.trackedTimes.moduleTime ={};
        }
        if(this.tracking.mouseData) {
            this.logv("initializing mouse tracking");
            //add a global click listener
            document.addEventListener("click", experimentr.trackClick, false);
            //add a global position listener
            document.addEventListener("mousemove", experimentr.updateMouse, false);
            experimentr.trackMouse();
        }
        this.postId = Date.now().toString(36);
        this.next();
        experimentr.__GlobalExperiment[this.postId] = this;

    };
    //some tracking handlers
    this.startPositionTracking = function() {
        this.trackedPositions[""+this.index] = {startTime:Date.now(), positionData : []};
        this.isTrackingPosition = true;
    };
    this.stopPositionTracking = function() {
        this.isTrackingPosition = false;
    };
    this.startClickTracking = function() {
        this.trackedClicks[""+this.index] = {startTime:Date.now(), clickData : []};
        this.isTrackingClicks = true;
    };
    this.stopClickTracking = function() {
        this.isTrackingClicks = false;
    };
    //go to next module
    this.endLastModuleTracking = function() {
        if(this.tracking.moduleTime && this.index !=0) { //track some times
            this.trackedTimes.moduleTime["time"+(this.index-1)].end = Date.now();
            this.logv("module "+(this.index-1)+"ending at "+
                this.trackedTimes.moduleTime["time"+(this.index-1)].end);
        }
        if(this.tracking.moduleTime) {
            this.trackedTimes.moduleTime["time"+this.index] = {start:Date.now()};
            this.logv("module "+this.index+" started at "+
                this.trackedTimes.moduleTime["time"+this.index].start);
        }
        if(this.tracking.mouseData) {
            //stop last module tracking
            if(this.clicklist.includes(this.index - 1)) { 
                this.stopClickTracking();
                this.logv("ending click tracking for "+(this.index - 1));
            }
            if(this.positionlist.includes(this.index - 1)) {
                this.stopPositionTracking();
                this.logv("ending position tracking for "+(this.index - 1));
            }
            //start new module tracking
            if(this.clicklist.includes(this.index)) { 
                this.startClickTracking();
                this.logv("starting click tracking for "+this.index);
            }
            if(this.positionlist.includes(this.index)) {
                this.startPositionTracking();
                this.logv("starting position tracking for "+this.index);
            }
        }
    };
    this.next = function() {
        this.index++; //increase index, move to next module

        this.logv("initializing module "+this.index);

        if(this.index==this.sequence.length) {
            throw 'No more modules left!';
            return;
        }
        

        this.parent.html(""); //clear parent element
        var currentmodule = this.sequence[this.index];
        experimentr.__GlobalExperiment = this; //TODO clean this up using callbacks; global vars bad
        //load the next module (using jquery load)

        var withoutslashes = window.location.href.split("/");
        var lastfilelength = withoutslashes[withoutslashes.length-1].length;

        var url = (window.location.href.substring(0, window.location.href.length-lastfilelength))+currentmodule;
        this.logv("url to be called: "+url);

        if (window.location.protocol == 'https:') {
          this.logv("we want https");
          url = 'https:' + url.substring(window.location.protocol.length);
          this.logv("new url: "+url);
        }
        this.parent.load(url, function() { //also do some callbacks for html content insertion
            var exp = experimentr.__GlobalExperiment;
            exp.logv("module "+exp.index+" successfully loaded, running callback methods");
            if($("#experimentFinish")) {
                $("#experimentFinish").click(function() {exp.finish(); });
                exp.logv("found a finish button");
            }
            if($("#experimentEnd")) {
                $("#experimentEnd").click(function() {exp.end(); });
                exp.logv("found a end button");
            }
            if($("#experimentNext")) {
                $("#experimentNext").click(function() {exp.next(); });
                exp.logv("found a next button");
            }
            if($("#experimentStart")) {
                $("#experimentStart").click(function() {exp.start(); });
                exp.logv("found a start button");
            }
            if($("#experimentId")) {
                $("#experimentId").html( exp.postId );
                exp.logv("found a postid tag");
            }
            

            //create click listeners
            for(var i=0; i<exp.clickSelectors.length; i++) {
                var selector = exp.clickSelectors[i];
                exp.logv("creating listeners for selector '"+selector+"' (index "+i+")");
                exp.logv("found:")
                exp.logv((function (jqobj) {
                    if(jqobj.first().html()) {
                        jqobj.each(function() {
                            exp.logv("- "+$(this)[0].outerHTML);
                        });
                        return "end find";
                    } else return '- nothing\nend find';
                })($(selector)));
                $('<span style="display:none" data-selector="'+
                    selector+'" data-sindex="'+i+'"></span>').insertAfter(selector);

                $(selector).click(function(event) {
                    exp.logv("found a click: "+$(this)[0].outerHTML);

                    var clickarr = exp.trackedClicks[""+exp.index];
                    clickarr.clickData.push({timeSinceStart:Date.now()-clickarr.startTime, 
                        objectClicked:$(this)[0].outerHTML, 
                        selector:$(this).next().attr('data-selector'),
                        selectorIndex:$(this).next().attr('data-sindex')});
                });
            }

            if(exp.handlers[currentmodule]) {
                exp.logv("found a handler for module "+exp.index+", running it");
                exp.handlers[currentmodule]();
            }
        });

        this.endLastModuleTracking();//do tracking

    };
    // this.parseMouseTrackingInputToList = function(input) {
    //     input  = "" + input; //parse into a string
    //     if(!input.length) input = [input]; //make it an array
    //     return input;
    // }
    this.getIndexArray = function(input) {
        if(input = 'all') {
            var allModules = [];
            for(var i=0; i<this.sequence.length; i++) {
                allModules.push(parseInt(i));
            }
            return allModules;
        } else return input; //TODO make this more flexible
    }

    //set mouse tracking parameters (must be called after starting mouse tracking, otherwise defaults)
    this.setMouseTracking = function(args) {
        this.logv("setting mouse tracking parameters")
        if(args.interval) this.mouseTrackingInterval = args.interval;
        if(args.both) {
            var indexArray = this.getIndexArray(args.both);
            this.positionlist = indexArray; 
            this.clicklist = indexArray; 
        } 
        else {
            if(args.position) this.positionlist = args.position;
            else this.positionlist = [];
            if(args.clicks)   this.clicklist = args.clicks;    
            else this.clicklist = [];
        }
    }
    //set general tracking parameters
    this.setTracking = function(args) { 
        this.logv("setting experiment tracking parameters");
        for (var arg in args) {
            if(this.tracking[arg] != undefined) {
                this.tracking[arg] = args[arg];
            } else {
                throw "Tracking parameter "+arg+" doesn't exist.";
            }
        }
        this.setMouseTracking({both:'all', interval:1}); //default mouse tracking parameters
    };
    //end the experiment but also save the data
    this.finish = function() {
        this.end();
        this.ajax();
    };
    //end the experiment - stop tracking
    this.end = function() {
        this.logv("end experiment: closing tracking");
        if(this.tracking.experimentTime) {
            this.trackedTimes.endTime = Date.now();
        }
        if(this.tracking.moduleTime) {
            this.trackedTimes.moduleTime["time"+(this.index)].end = Date.now();
        }
        if(this.tracking.mouseData) {
            this.stopClickTracking();
            this.stopPositionTracking();
        }
    };
    //get the index of a module name in the sequence
    this.getModuleIndex = function(moduleName) {
        for(var i=0; i<this.sequence.length; i++) {
            if(this.sequence[i]==moduleName) return i;
        } 
        return -1;
    };
    //get all data (include tracking data)
    this.getAllData = function() {
        this.logv("returning aggregate subject and tracking data");
        var dataobj = {subjectData:this.data};
        if(this.tracking.experimentTime || this.tracking.moduleTime) {
            dataobj["times"] = this.trackedTimes;
        }
        if(this.tracking.mouseData) {
            dataobj["mouseData"] = {clicks:this.trackedClicks, positions:this.trackedPositions};
        }
        this.logvv(dataobj);
        return dataobj;
    }; 
    //instead of putting a script in the module code, attach one from init
    this.attachScript = function(module, handler) {
        this.logv("attaching handler to '"+module+"'");
        var thismodule;
        if(typeof module == "string") {
            thismodule = this.sequence[this.getModuleIndex(experimentr.getModuleString(module))];
        }  else if(typeof module == "number") {
            thismodule = this.sequence[module];
        }
        this.handlers[thismodule] = handler;
    };

    //some default ajax stuff for ease of use
    //it is recommended that you use your own ajax function
    this.ajax = function(callback, style, action) { //possibly put this into experimentr object
        this.logv("invoking experimentr ajax sequence");
        var formaction = action;
        if(!action) {
            formaction = "action_page.php";
        }
        this.logv("the form action is '"+formaction+"'");
        if(style=="json" || !style) {
            var datastring = JSON.stringify(this.getAllData());
        } else if (style=="csv") {

        }
        this.logv("using format "+((!style) ? "'json'" : ("'"+style+"'")));

        this.logv("sending data to server...");
        if(callback) {
            this.logv("using callback:");
            this.logv(callback);
        } else {
            this.logv("using default callback, setting content of #experimentReturn");
        }
        
        $.post( formaction, { postid: this.postId, data: datastring })
        .done(function(data) {
            if(!callback) {
                $("#experimentReturn").html("The website says: " + data );
            } else {
                callback(data);
            }
        });
    };
    //pass in a jquery selector. any elements matched to this selector will be monitored for clicks
    this.addClickListeners = function() {
        this.logv("beginning to add click listeners");
        var args = Array.prototype.slice.call(arguments, 0);
        for(var i=0; i<args.length; i++) {
            this.logv("adding listener '"+args[i]+"'")
            if(typeof args[i] == "string") {
                this.clickSelectors.push(args[i]);
            } else {
                throw "Invalid selector "+args[i];
            }
        }
    };
    //tools for verbose logging
    this.logv = function(printstring) {
        if(this.verboseLevel == 1 || this.verboseLevel == 2) console.log(printstring);
    };
    this.logvv = function(printstring) {
        if(this.verboseLevel == 2) console.log(printstring);
    };

    this.setModule = function(moduleName) {
        var moduleNumber;
        if(typeof moduleName == 'number') {
            if(moduleName > this.sequence.length-1 || moduleName < 0 || moduleName % 1 != 0) {
                throw 'Invalid module number!';
            } else { moduleNumber = moduleName - 1; }
        } else if(typeof moduleName == 'string') {
            var mi = this.getModuleIndex(experimentr.getModuleString(moduleName));
            if(mi) { moduleNumber = mi-1;}
            else {throw 'Invalid module name!';}
        }
        this.index++;
        this.endLastModuleTracking();

        this.index = moduleNumber;
        this.next();
    };
}

//global functions and parameters
var experimentr = {
    __GlobalExperiment: {},
    cursor:{x:0, y:0},
    create: function() {
        return new Experiment();
    },
    getModuleString: function(oldarg) {
        var newarg = oldarg;
        if(oldarg.slice(-1)=="/") { newarg = newarg+"index.html"; }
        else {
            if(oldarg.slice(-4)=="html") newarg = newarg;
            else newarg = newarg + "/index.html";
        }
        return newarg;
    },
    frameCount:0,
    trackMouse: function() {
        var exp = experimentr.__GlobalExperiment;
        if(experimentr.frameCount % experimentr.__GlobalExperiment.mouseTrackingInterval == 0) {
            if(exp.isTrackingPosition) {
                exp.logvv("mouse position logged: "+JSON.stringify({frame:this.frameCount, 
                            x: experimentr.cursor.x, y: experimentr.cursor.y}));
                var moduleIndex = exp.index;
                var mouseObject = exp.trackedPositions[""+moduleIndex];
                mouseObject.positionData.push({
                    timeSinceStart: Date.now()-mouseObject.startTime, 
                    x: experimentr.cursor.x, y: experimentr.cursor.y});
            }
        }
        experimentr.frameCount++;
        window.requestAnimationFrame(experimentr.trackMouse);
    },
    updateMouse: function(event) {
        experimentr.cursor.x = event.clientX;
        experimentr.cursor.y = event.clientY;
    },
    trackClick: function(event) {
        var exp = experimentr.__GlobalExperiment;
        if(exp.isTrackingClicks) {
            var moduleIndex = exp.index;
            var clickObject = exp.trackedClicks[""+moduleIndex];
            clickObject.clickData.push({
                timeSinceStart: Date.now()-clickObject.startTime, x: event.clientX, y: event.clientY});
            exp.logv("found a click: "+JSON.stringify({x: event.clientX, y: event.clientY}));
        }
    },
    createValidation: function(elementList, type) {
        if(typeof elementList == "string") {
            elementList = [elementList];
        }
        if(!type) {
            type = 
        }
        console.log(type);
    }
};