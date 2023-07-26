<?php
    require_once("/usr/local/emhttp/plugins/docker.folder/server/lib.php");
    require_once("$documentRoot/plugins/dynamix.docker.manager/include/DockerClient.php");

    $dockerTemplates = new DockerTemplates();
    $info = $dockerTemplates->getAllInfo();
    echo json_encode($info);
?>