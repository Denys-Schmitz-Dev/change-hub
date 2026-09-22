<?php

use App\Http\Controllers\ArtifactController;
use App\Http\Controllers\CaptureController;
use App\Http\Controllers\HubController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\SessionController;
use App\Http\Controllers\TestSuiteController;
use Illuminate\Support\Facades\Route;

Route::get('/', [HubController::class, 'index'])->name('home');
Route::get('/projects/create', [ProjectController::class, 'create'])->name('projects.create');
Route::post('/projects', [ProjectController::class, 'store'])->name('projects.store');
Route::get('/projects/{project}/environments/create', [ProjectController::class, 'environment'])->name('environments.create');
Route::post('/projects/{project}/environments', [ProjectController::class, 'storeEnvironment'])->name('environments.store');
Route::get('/sessions/create', [SessionController::class, 'create'])->name('sessions.create');
Route::post('/sessions', [SessionController::class, 'store'])->name('sessions.store');
Route::get('/sessions/{session}', [SessionController::class, 'show'])->name('sessions.show');
Route::post('/sessions/{session}/captures', [CaptureController::class, 'store'])->name('captures.store');
Route::get('/artifacts/{artifact}', [ArtifactController::class, 'show'])->name('artifacts.show');

Route::post('/sessions/{session}/suites', [TestSuiteController::class, 'store'])->name('suites.store');
Route::post('/suites/{suite}/runs', [TestSuiteController::class, 'run'])->name('suites.run');
Route::post('/suites/{suite}/video', [TestSuiteController::class, 'updateVideo'])->name('suites.video');
Route::post('/suites/{suite}/tests', [TestSuiteController::class, 'discover'])->name('suites.tests');
Route::get('/suite-runs/{run}/artifacts/{file}', [TestSuiteController::class, 'artifact'])->where('file', '[a-f0-9]+\.(png|zip|txt|webm)')->name('suites.artifact');
