/****************************************************************************
 Copyright (c) 2016 Chukong Technologies Inc.

 http://www.cocos2d-x.org

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the 'Software'), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

var Path = require('../utils/CCPath');
var Sys = require('../platform/CCSys');
var Pipeline = require('./pipeline');
require('../../audio/CCAudio');

var __audioSupport = Sys.__audioSupport;
var formatSupport = __audioSupport.format;
var context = __audioSupport.context;

function loadAudioFromExtList (url, typeList, audio, cb){
    if(typeList.length === 0){
        var ERRSTR = 'can not found the resource of audio! Last match url is : ';
        ERRSTR += url.replace(/\.(.*)?$/, '(');
        formatSupport.forEach(function(ext){
            ERRSTR += ext + '|';
        });
        ERRSTR = ERRSTR.replace(/\|$/, ')');
        return cb({status: 520, errorMessage: ERRSTR}, null);
    }

    url = Path.changeExtname(url, typeList.splice(0, 1));

    if (__audioSupport.WEB_AUDIO) {//Buffer
        if (__audioSupport.webAudioCallback) {
            __audioSupport.webAudioCallback(url);
        }
        var request = Pipeline.getXMLHttpRequest();
        request.open('GET', url, true);
        request.responseType = 'arraybuffer';

        request.onload = function () {
            context['decodeAudioData'](request.response, function (buffer) {
                //success
                audio.setBuffer(buffer);
                cb(null, audio);
            }, function() {
                //error
                loadAudioFromExtList(url, typeList, audio, cb);
            });
        };

        request.onerror = function () {
            cb({status: 520, errorMessage: ERRSTR}, null);
        };

        request.send();
    } else {//DOM
        var element = document.createElement('audio');
        var cbCheck = false;
        var termination = false;

        var timer = setTimeout(function () {
            if (element.readyState === 0) {
                emptied();
            } else {
                termination = true;
                element.pause();
                document.body.removeChild(element);
                cb('Audio load timeout : ' + url, audio);
            }
        }, 8000);

        var success = function () {
            if (!cbCheck) {
                //element.pause();
                try { 
                    element.currentTime = 0;
                    element.volume = 1; 
                } catch (e) {}
                document.body.removeChild(element);
                audio.setElement(element);
                element.removeEventListener('canplaythrough', success, false);
                element.removeEventListener('error', failure, false);
                element.removeEventListener('emptied', emptied, false);
                !termination && cb(null, audio);
                cbCheck = true;
                clearTimeout(timer);
            }
        };

        var failure = function(){
            if (!cbCheck) return;
            //element.pause();
            document.body.removeChild(element);
            element.removeEventListener('canplaythrough', success, false);
            element.removeEventListener('error', failure, false);
            element.removeEventListener('emptied', emptied, false);
            !termination && loadAudioFromExtList(url, typeList, audio, cb);
            cbCheck = true;
            clearTimeout(timer);
        };

        var emptied = function(){
            termination = true;
            success();
            cb(null, audio);
        };

        element.addEventListener('canplaythrough', success, false);
        element.addEventListener('error', failure, false);
        if(__audioSupport.USE_EMPTIED_EVENT)
            element.addEventListener('emptied', emptied, false);

        element.src = url;
        document.body.appendChild(element);
        element.volume = 0;
        //some browsers cannot pause(qq 6.1)
        //element.play();
    }
}

function downloadAudio (item, callback) {
    if (formatSupport.length === 0) {
        return callback( new Error('Audio Downloader: audio not supported on this browser!') );
    }

    var url = item.src,
        extname = Path.extname(url),
        typeList = [extname],
        i, audio;

    // Generate all types
    for (i = 0; i < formatSupport.length; i++) {
        if (extname !== formatSupport[i]) {
            typeList.push(formatSupport[i]);
        }
    }

    if (__audioSupport.WEB_AUDIO) {
        try {
            var volume = context['createGain']();
            volume['gain'].value = 1;
            volume['connect'](context['destination']);
            audio = new cc.Audio(context, volume, url);
            if (__audioSupport.NEED_MANUAL_LOOP) {
                audio._manualLoop = true;
            }
        } catch(err) {
            __audioSupport.WEB_AUDIO = false;
            cc.warn('The current browser don\'t support web audio');
            audio = new cc.Audio(null, null, url);
        }
    } else {
        audio = new cc.Audio(null, null, url);
    }

    // hack for audio to be found before loaded
    item.content = audio;
    loadAudioFromExtList(url, typeList, audio, callback);
}


module.exports = downloadAudio;