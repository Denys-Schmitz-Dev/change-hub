<?php

return ['node' => env('HUB_NODE', 'node'), 'docker_image' => env('HUB_DOCKER_IMAGE', 'mcr.microsoft.com/playwright:v1.63.0-noble'), 'capture_timeout' => 240, 'profile_version' => 1];
