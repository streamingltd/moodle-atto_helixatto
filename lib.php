<?php
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

/**
 * Atto text editor integration version file.
 *
 * @package    atto_helixatto
 * @copyright  2014 Streaming LTD
 * @author     Tim Williams (tmw@autotrain.org)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();
require_once($CFG->dirroot . '/mod/helixmedia/locallib.php');
require_once($CFG->dirroot . '/lib/filterlib.php');

/**
 * Initialise this plugin
 */
function atto_helixatto_strings_for_js() {
    global $PAGE;

    $PAGE->requires->strings_for_js(
        ['insert', 'cancel', 'dialogtitle', 'showvideo', 'iframe', 'thumbnail', 'link',
        'newtab',
        'inserttype'],
        'atto_helixatto'
    );
}

/**
 * Parses a list of module types and checks if they match the one we are in.
 * @param string $param
 */
function atto_helixatto_checklist($param) {
    global $PAGE, $DB;
    $config = get_config('atto_helixatto', $param);
    $types = explode("\n", $config);
    for ($i = 0; $i < count($types); $i++) {
        $types[$i] = trim($types[$i]);
        if (
            strlen($types[$i]) > 0 && strpos($PAGE->pagetype, 'mod-' . $types[$i]) !== false &&
            $DB->get_record('modules', ['name' => $types[$i]])
        ) {
            return $types[$i];
        }
    }

    return false;
}

/**
 * Checkes if this supplied context has the MEDIAL filter enabled
 * @param context $context
 * @return boolean true if it does
 */
function atto_helixatto_has_filter($context = false) {
    if ($context !== false) {
        $filters = filter_get_active_in_context($context);
        if (array_key_exists('medial', $filters)) {
            return true;
        }
        return false;
    }

    global $DB;
    // If there is no context then we just need to know that the filter is active somewhere in Moodle.
    $rec = $DB->get_records('filter_active', ['filter' => 'medial', 'active' => 1]);
    if ($rec && count($rec) > 0) {
        return true;
    }

    return false;
}


/**
 * Return the js params required for this module.
 * @param int $elementid
 * @param object $options
 * @param object $fpoptions
 * @return array of additional params to pass to javascript init function for this module.
 */
function atto_helixatto_params_for_js($elementid, $options, $fpoptions) {
    global $USER, $COURSE, $CFG, $PAGE;

    $coursecontext = context_course::instance($COURSE->id);
    $usercontextid = context_user::instance($USER->id)->id;
    $hasfilter = atto_helixatto_has_filter($coursecontext);

    $params = [];
    $params['usercontextid'] = $usercontextid;
    $params['disabled'] = true;
    $params['modtype'] = "";
    if (!$hasfilter) {
        $params['placeholder'] = 0;
    } else {
        $params['placeholder'] = get_config('atto_helixatto', 'placeholder');
    }
    $params['linkonly'] = false;

    if ($params['placeholder'] == 1) {
        $params['linkonly'] = true;
    } else {
        if (atto_helixatto_checklist('uselinkdesc')) {
            $params['linkonly'] = true;
        }
    }

    $mtype = atto_helixatto_checklist('modtypeperm');

    if ($mtype) {
        if (has_capability('atto/helixatto:visiblemodtype', $coursecontext)) {
            $params['disabled'] = false;
            $params['modtype'] = $mtype;
            $params['linkonly'] = true;
        }
    } else {
        if (has_capability('atto/helixatto:visible', $coursecontext)) {
            $params['disabled'] = false;
        }
    }

    // This hides the button in specific situations where we want people to use the plugin, eg in the MEDIAL activity
    // and the assign grading interface where we want people to use Feedback.
    if ($PAGE->cm) {
        switch ($PAGE->cm->modname) {
            case "helixmedia":
                $params['disabled'] = true;
                break;
            case "assign":
                $action = $PAGE->url->get_param("action");
                if (($action == "grader" || $action == "grade" ) && !get_config('tiny_medial', 'allowfeedback')) {
                    $params['disabled'] = true;
                }
                break;
        }
    } else {
        // Object $PAGE->cm is false when adding a new instance, so check the URL and see if we're adding a MEDIAL activity.
        if ($PAGE->url->get_path() == "/course/modedit.php" && $PAGE->url->get_param("add") == "helixmedia") {
            $params['disabled'] = true;
        }
    }

    $params['baseurl'] = $CFG->wwwroot;
    $params['ltiurl'] = helixmedial_launch_url();
    $params['statusurl'] = helixmedia_get_status_url();
    $params['userid'] = $USER->id;
    $params['insertdelay'] = get_config('helixmedia', 'modal_delay');
    if (get_config('helixmedia', 'ltiversion') == LTI_VERSION_1) {
        $params['oauthConsumerKey'] = get_config('helixmedia', 'consumer_key');
    } else {
        $params['oauthConsumerKey'] = false;
    }
    if ($params['insertdelay'] > -1) {
        $params['hideinsert'] = get_config('atto_helixatto', 'hideinsert');
    } else {
        $params['hideinsert'] = 0;
    }
    $params['playersizeurl'] = helixmedia_get_playerwidthurl();
    $params['course'] = $COURSE->id;
    if ($hasfilter == 1) {
        if (get_config('atto_helixatto', 'embedopt') == 1) {
            $params['hasfilter'] = true;
        } else {
            $params['hasfilter'] = false;
        }
    } else {
        $params['hasfilter'] = false;
    }
    return $params;
}
