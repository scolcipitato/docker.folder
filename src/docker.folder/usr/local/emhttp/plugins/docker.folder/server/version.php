<?php
    require_once("/usr/local/emhttp/plugins/docker.folder/server/lib.php");
    if(file_exists("$configDir/version")) {
        echo file_get_contents("$configDir/version");
    } else {
        echo '0.0.0';
    }
?>