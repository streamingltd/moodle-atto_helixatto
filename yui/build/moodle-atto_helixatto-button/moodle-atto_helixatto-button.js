YUI.add('moodle-atto_helixatto-button', function (Y, NAME) {

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
            if (i == 0) {
                preid = event.data.substring(6);
                interval = setTimeout(buttonInstance._checkStatus, 5000);
            }
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

        if (dialogueInstance !== null && dialogueInstance.get("visible") == false) {
            gotIn = false;
            return;
        }

        if (xmlDoc.responseText == "IN") {
            gotIn = true;
        }

        if (xmlDoc.responseText == "OUT" && gotIn == true) {
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

        xmlDoc.onload = function(response) {
            if (xmlDoc.status >= 200 && xmlDoc.status < 400) {
                var resp = xmlDoc.responseText.split(':');
                var audioonly = 0;
                if (resp.length == 3 && resp[2] == 'Y') {
                    audioonly = 1;
                }

                var inserttype = 'iframe';
                var it = document.getElementById('medial_insert_type');
                if (it) {
                    inserttype = it.value;
                }

                inserted = true;
                obj.editor.focus();

                var url = embedLaunchURL + "?type=16&responsive=1&medialembed=" + inserttype + "&audioonly=" +
                    audioonly + "&l=" + preid;
                var html = "";
                if (obj.get('linkonly') || inserttype != 'iframe') {
                    html = "<a href='" + url + "' target='_blank'>" + M.util.get_string('showvideo', COMPONENTNAME) + "</a>";
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

                obj.get('host').insertContentAtFocusPoint(html);
                obj.markUpdated();
                dialogueInstance.hide();
            }
        };
        xmlDoc.open("POST", buttonInstance.get('playersizeurl'), true);
        xmlDoc.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xmlDoc.send(params);
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


}, '@VERSION@', {"requires": ["moodle-editor_atto-plugin"]});
