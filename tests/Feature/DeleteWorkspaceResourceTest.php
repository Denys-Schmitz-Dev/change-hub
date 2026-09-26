<?php

namespace Tests\Feature;

use App\Models\CaptureRun;
use App\Models\ChangeSession;
use App\Models\Environment;
use App\Models\Project;
use App\Models\SuiteRun;
use App\Models\TestSuite;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class DeleteWorkspaceResourceTest extends TestCase
{
    use RefreshDatabase;

    public function test_deleting_a_session_removes_records_and_private_artifacts(): void
    {
        $session = ChangeSession::factory()->create();
        $capture = CaptureRun::factory()->create(['change_session_id' => $session->id, 'status' => 'complete']);
        $suite = TestSuite::factory()->create(['change_session_id' => $session->id]);
        $suiteRun = SuiteRun::factory()->create(['test_suite_id' => $suite->id, 'status' => 'complete']);
        File::ensureDirectoryExists(storage_path('app/private/captures/'.$capture->id));
        File::ensureDirectoryExists(storage_path('app/private/suites/'.$suiteRun->id));

        $this->delete(route('sessions.destroy', $session))->assertRedirect(route('home', ['view' => 'projects']));

        $this->assertModelMissing($session);
        $this->assertDatabaseMissing('capture_runs', ['id' => $capture->id]);
        $this->assertDatabaseMissing('suite_runs', ['id' => $suiteRun->id]);
        $this->assertDirectoryDoesNotExist(storage_path('app/private/captures/'.$capture->id));
        $this->assertDirectoryDoesNotExist(storage_path('app/private/suites/'.$suiteRun->id));
    }

    public function test_deleting_a_project_cascades_through_all_sessions(): void
    {
        $project = Project::factory()->create();
        $environment = Environment::factory()->create(['project_id' => $project->id]);
        $session = ChangeSession::factory()->create(['environment_id' => $environment->id]);

        $this->delete(route('projects.destroy', $project))->assertRedirect(route('home', ['view' => 'projects']));

        $this->assertModelMissing($project);
        $this->assertModelMissing($environment);
        $this->assertModelMissing($session);
    }

    public function test_active_work_prevents_deletion(): void
    {
        $session = ChangeSession::factory()->create();
        CaptureRun::factory()->create(['change_session_id' => $session->id, 'status' => 'running']);

        $this->delete(route('sessions.destroy', $session))->assertSessionHasErrors('delete');
        $this->assertModelExists($session);
    }
}
