// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/*
 * @package    atto_helixatto
 * @copyright  COPYRIGHTINFO
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * @module moodle-atto_helixatto-button
 */

/**
 * Atto text editor helixatto plugin.
 *
 * @namespace M.atto_helixatto
 * @class button
 * @extends M.editor_atto.EditorPlugin
 */

var COMPONENTNAME = 'atto_helixatto';

var TEMPLATE = '' +
    '<form class="atto_form">' +
        '<div id="{{elementid}}_{{innerform}}" class="mdl-align" style="height:{{height}}px">' +
            '<iframe id="medialiframe" style="border:0px;margin:0px;background:#ffffff;width:100%;height:{{iheight}};" ' +
            'src="{{iframesrc}}" allow="{{allow}}"></iframe>' +
            '<div class="{{hasfilter}}">{{get_string "inserttype" component}} ' +
            '<select id="medial_insert_type" name="medial_insert_type" class="custom-select">' +
            '<option value="iframe">{{get_string "iframe" component}}</option>' +
            '<option value="thumbnail">{{get_string "thumbnail" component}}</option>' +
            '<option value="link">{{get_string "link" component}}</option>' +
            '</select></div>' +
            '<button id="medial_insert" class="btn btn-secondary submit {{hidden}}"> ' +
            '{{get_string "insert" component}}</button>' +
        '</div>' +
    '</form>';


var preid = -1;
var inserted = false;
var hmlLaunchURL = '';
var embedLaunchURL = '';
var ltiurl = '';
var interval = null;
var buttonInstance = '';
var dialogueInstance = null;

var dwidth = 935;
var dheight = 435;

var gotIn = false;

Y.namespace('M.atto_helixatto').Button = Y.Base.create('button', Y.M.editor_atto.EditorPlugin, [], {


    /**
     * Initialize the button
     *
     * @method Initializer
     */
    initializer: function() {
        // If we don't have the capability to view then give up.
        if (this.get('disabled')) {
            return;
        }

        if (window.location.href.indexOf("action=grader") > -1) {
            return;
        }

        this.addButton({
            icon: 'ed/helixadd',
            iconComponent: 'atto_helixatto',
            buttonName: 'helixadd',
            callback: this._displayDialogue
        });

        window.addEventListener("message", this._receiveMessage, false);

        hmlLaunchURL = this.get('baseurl') + "/mod/helixmedia/launch.php";
        if (this.get('placeholder') == 1) {
            embedLaunchURL = "{{{medial_launch_base}}}/mod/helixmedia/launch.php";
        } else {
            embedLaunchURL = hmlLaunchURL;
        }

        ltiurl = this.get('ltiurl');
        // The interval timer doesn't seem to get the right scope for "this" to work inside _checkStatus, so set a global var here.
        buttonInstance = this;
    },

    /**
     * Listener for the helix selection complete event.
     **/
    _receiveMessage: function(event) {
        if (typeof event.data === 'string' || event.data instanceof String) {
            var i = event.data.indexOf("preid_");
            if (i === 0) {
                preid = event.data.substring(6);
                if (buttonInstance.get('oauthConsumerKey')) {
                    interval = setTimeout(buttonInstance._checkStatus, 5000);
                }
            }
        }

        // Return data for LTI 1.3
        if (typeof event.data === 'object') {
            buttonInstance._setCustomLink(event.data);
        }
    },

    /**
     * Monitors the status of the video selection on the HML server
     * Note, this doesn't use setInterval so that this check will quickly die if there is a problem
     * rather than continuing for ever. The check is a convenience and isn't critical to the operation
     * of the plugin.
     **/

    _checkStatus: function() {
        var xmlDoc = new XMLHttpRequest();

        var params = "resource_link_id=" + preid + "&user_id=" + buttonInstance.get('userid') +
            "&oauth_consumer_key=" + buttonInstance.get('oauthConsumerKey');
        xmlDoc.open("POST", buttonInstance.get('statusurl'), false);
        xmlDoc.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xmlDoc.send(params);

        if (dialogueInstance !== null && dialogueInstance.get("visible") === false) {
            gotIn = false;
            return;
        }

        if (xmlDoc.responseText == "IN") {
            gotIn = true;
        }

        if (xmlDoc.responseText == "OUT" && gotIn === true) {
                gotIn = false;
                buttonInstance._doInsert();
        } else {
            interval = setTimeout(buttonInstance._checkStatus, 2000);
        }
    },

     /**
      * Display the helixatto Dialogue
      *
      * @method _displayDialogue
      * @private
      */
    _displayDialogue: function(e) {
        e.preventDefault();

        // The interval timer doesn't seem to get the right scope for "this" to work inside _checkStatus, so set a global var here.
        buttonInstance = this;

        inserted = false;
        var width = document.documentElement.clientWidth - 10;
        var height = document.documentElement.clientHeight - 55;

        if (width > 935) {
            width = 935;
        }
        if (height > 1400) {
            height = 1400;
        }

        dwidth = width;
        dheight = height;

        dialogueInstance = this.getDialogue({
            headerContent: M.util.get_string('dialogtitle', COMPONENTNAME),
            width: width + 'px',
            height: height + 'px',
            draggable: false,
            overflowX: 'auto',
            constraintoviewport: false
        });

        // Dialog doesn't detect changes in width without this - if you reuse the dialog, this seems necessary.
        if (dialogueInstance.width !== width + 'px') {
            dialogueInstance.set('width', width + 'px');
        }

        // Append launch code
        var hidden = '';
        var iheight = '100%';
        if (buttonInstance.get('hideinsert') == "1") {
            hidden = "hidden";
        }

        var hasfilter = 'hidden';
        if (buttonInstance.get('hasfilter')) {
            hasfilter = '';
        }

        if (buttonInstance.get('hideinsert') == "1" || buttonInstance.get('hasfilter')) {
            iheight = (height - 135) + "px";
        }

        var buttonform = this._getFormContent(hidden, iheight, hasfilter);

        var bodycontent = Y.Node.create('<div></div>');
        bodycontent.append(buttonform);

        // Set to bodycontent.
        dialogueInstance.set('bodyContent', bodycontent);

        dialogueInstance.show();

    },


     /**
      * Return the dialogue content for the tool, attaching any required
      * events.
      *
      * @method _getDialogueContent
      * @return {Node} The content to place in the dialogue.
      * @private
      */
    _getFormContent: function(hidden, iheight, hasfilter) {

        var template = Y.Handlebars.compile(TEMPLATE),
            content = Y.Node.create(template({
                elementid: this.get('host').get('elementid'),
                component: COMPONENTNAME,
                iframesrc: hmlLaunchURL + "?type=15&modtype=" + this.get('modtype'),
                allow: 'microphone ' + ltiurl + '; camera ' + ltiurl + '; display-capture ' + ltiurl + ';',
                width: dwidth - 30,
                height: dheight - 90,
                style: "border:0px;",
                hidden: hidden,
                iheight: iheight,
                hasfilter: hasfilter
            }));

        this._form = content;
        this._form.one('#medial_insert').on('click', this._doInsert, this);

        return content;
    },

    /**
     * Inserts the users input onto the page
     * @method _getDialogueContent
     * @private
     */

    _doInsert: function(e) {
        if (typeof e != "undefined") {
            e.preventDefault();
        }

        if (inserted) {
            return;
        }

        var obj = this;

        var xmlDoc = new XMLHttpRequest();
        var params = "resource_link_id=" + preid + "&user_id=" + buttonInstance.get('userid') +
            "&oauth_consumer_key=" + buttonInstance.get('oauthConsumerKey') +
            "&context_id=" + buttonInstance.get('course') +
            "&include_height=Y";

        xmlDoc.onload = function() {
            if (xmlDoc.status >= 200 && xmlDoc.status < 400) {
                var resp = xmlDoc.responseText.split(':');
                var audioonly = 0;
                if (resp.length == 3 && resp[2] == 'Y') {
                    audioonly = 1;
                }

                obj._setLink(audioonly, "", false);
            }
        };
        xmlDoc.open("POST", buttonInstance.get('playersizeurl'), true);
        xmlDoc.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xmlDoc.send(params);
    },

    /**
     * Read LTI 1.3 custom data to create a link
     * @method _setCustomLink
     * @private
     */
    _setCustomLink: function(data) {
        if (!('title' in data) || !('custom' in data) || !('audioonly' in data.custom)) {
            /* eslint-disable no-console */
            console.log("Bad message data");
            console.log(data);
            /* eslint-enable no-console */
            return;
        }

        // The custom data uses strings for everything becase the spec doesn't allow for other types.
        var audioonly = 0;
        if (data.custom.audioonly.toLowerCase() === "true") {
            audioonly = 1;
        }

        buttonInstance._setLink(audioonly, data.title, data.custom.video_ref);
     },

    /**
     * Creates a link to insert into the html
     * @method _setLink
     * @private
     */
    _setLink: function(audioonly, title, videoref) {
        var inserttype = 'iframe';
        var it = document.getElementById('medial_insert_type');
        if (it) {
            inserttype = it.value;
        }

        inserted = true;
        buttonInstance.editor.focus();

        var data = {
            "type": 16,
            "responsive": 1,
            "medialembed": inserttype,
            "audioonly": audioonly,
            "l": preid
        };

        if (videoref) {
            data.video_ref = videoref;
        }

        var hash = buttonInstance._generateSHA256Hash(JSON.stringify(data));
            data.sig = hash;
            data = JSON.stringify(data);
            var url = embedLaunchURL + "?data="+btoa(data);

            var html = "";
            if (buttonInstance.get('linkonly') || inserttype != 'iframe') {
                html = "<a href='" + url + "' title='" + title + "' target='_blank'>" +
                    M.util.get_string('showvideo', COMPONENTNAME) + "</a>";
            } else {
                if (audioonly == 1) {
                    html = "<div class='embed-responsive helixmedia_embedheight' style='height:100px' id='mediallaunch-" +
                        preid + "'>";
                } else {
                    html = "<div class='embed-responsive embed-responsive-16by9 helixmedia_embedheight' id='mediallaunch-" +
                        preid + "'>";
                }

                html += "<iframe class='embed-responsive-item overflow-auto border-0' " +
                    "src='" + url + "' allowfullscreen='true' webkitallowfullscreen='true' " +
                    "mozallowfullscreen='true'></iframe></div>";
            }

            buttonInstance.get('host').insertContentAtFocusPoint(html);
            buttonInstance.markUpdated();
            dialogueInstance.hide();
    },

    _generateSHA256Hash: function (ascii) {

        function rightRotate(value, amount) {
            return (value>>>amount) | (value<<(32 - amount));
        };

        var sha256 = {};
        var mathPow = Math.pow;
        var maxWord = mathPow(2, 32);
        var lengthProperty = 'length'
        var i, j; // Used as a counter across the whole file
        var result = ''

        var words = [];
        var asciiBitLength = ascii[lengthProperty]*8;

        //* caching results is optional - remove/add slash from front of this line to toggle
        // Initial hash value: first 32 bits of the fractional parts of the square roots of the first 8 primes
        // (we actually calculate the first 64, but extra values are just ignored)
        var hash = sha256.h = sha256.h || [];
        // Round constants: first 32 bits of the fractional parts of the cube roots of the first 64 primes
        var k = sha256.k = sha256.k || [];
        var primeCounter = k[lengthProperty];
        /*/
        var hash = [], k = [];
        var primeCounter = 0;
        //*/

        var isComposite = {};
        for (var candidate = 2; primeCounter < 64; candidate++) {
            if (!isComposite[candidate]) {
                for (i = 0; i < 313; i += candidate) {
                    isComposite[i] = candidate;
                }
                hash[primeCounter] = (mathPow(candidate, .5)*maxWord)|0;
                k[primeCounter++] = (mathPow(candidate, 1/3)*maxWord)|0;
            }
        }

        ascii += '\x80' // Append Ƈ' bit (plus zero padding)
        while (ascii[lengthProperty]%64 - 56) ascii += '\x00' // More zero padding
        for (i = 0; i < ascii[lengthProperty]; i++) {
            j = ascii.charCodeAt(i);
            if (j>>8) return; // ASCII check: only accept characters in range 0-255
            words[i>>2] |= j << ((3 - i)%4)*8;
        }
        words[words[lengthProperty]] = ((asciiBitLength/maxWord)|0);
        words[words[lengthProperty]] = (asciiBitLength)

        // process each chunk
        for (j = 0; j < words[lengthProperty];) {
            var w = words.slice(j, j += 16); // The message is expanded into 64 words as part of the iteration
            var oldHash = hash;
            // This is now the undefinedworking hash", often labelled as variables a...g
            // (we have to truncate as well, otherwise extra entries at the end accumulate
            hash = hash.slice(0, 8);

            for (i = 0; i < 64; i++) {
                var i2 = i + j;
                // Expand the message into 64 words
                // Used below if 
                var w15 = w[i - 15], w2 = w[i - 2];

                // Iterate
                var a = hash[0], e = hash[4];
                var temp1 = hash[7]
                    + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) // S1
                    + ((e&hash[5])^((~e)&hash[6])) // ch
                    + k[i]
                    // Expand the message schedule if needed
                    + (w[i] = (i < 16) ? w[i] : (
                        w[i - 16]
                        + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15>>>3)) // s0
                        + w[i - 7]
                        + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2>>>10)) // s1
                    )|0
                );
                // This is only used once, so *could* be moved below, but it only saves 4 bytes and makes things unreadble
                var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) // S0
                    + ((a&hash[1])^(a&hash[2])^(hash[1]&hash[2])); // maj

                hash = [(temp1 + temp2)|0].concat(hash); // We don't bother trimming off the extra ones, they're harmless as long as we're truncating when we do the slice()
                hash[4] = (hash[4] + temp1)|0;
            }

            for (i = 0; i < 8; i++) {
                hash[i] = (hash[i] + oldHash[i])|0;
            }
        }

        for (i = 0; i < 8; i++) {
            for (j = 3; j + 1; j--) {
                var b = (hash[i]>>(j*8))&255;
                result += ((b < 16) ? 0 : '') + b.toString(16);
            }
         }
         return result;
    }
},
{
    ATTRS: {
        disabled: {
            value: false
        },
        linkonly: {
            value: false
        },
        usercontextid: {
            value: null
        },
        baseurl: {
            value: ''
        },
        ltiurl: {
            value: ''
        },
        statusurl: {
            value: ''
        },
        userid: {
            value: ''
        },
        hideinsert: {
            value: ''
        },
        insertdelay: {
            value: ''
        },
        oauthConsumerKey: {
            value: ''
        },
        modtype: {
            value: ''
        },
        placeholder: {
            value: false
        },
        playersizeurl: {
            value: ''
        },
        course: {
            value: 0
        },
        hasfilter: {
            value: false
        }
    }
});
