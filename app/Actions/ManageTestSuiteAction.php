<?php

namespace App\Actions;

use App\Models\ChangeSession;
use App\Models\TestSuite;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Validation\ValidationException;

class ManageTestSuiteAction
{
    public function handle(TestSuite $suite, ?array $data): void
    {
        $runIds = DB::transaction(function () use ($suite, $data): array {
            $session = ChangeSession::whereKey($suite->change_session_id)->lockForUpdate()->firstOrFail();
            $suite = TestSuite::whereKey($suite->id)->lockForUpdate()->firstOrFail();
            if ($session->runs()->whereIn('status', ['queued', 'running'])->exists() || $session->suites()->whereHas('runs', fn ($query) => $query->whereIn('status', ['queued', 'running']))->exists()) {
                throw ValidationException::withMessages(['suite' => 'Wait for this session’s queued or running captures to finish before editing or removing a suite.']);
            }
            app(SessionBaselineAction::class)->handle($session);
            if ($data === null) {
                $ids = $suite->runs()->pluck('id')->all();
                $suite->delete();

                return $ids;
            }
            $root = realpath($session->profile['repository']);
            $data['config'] = substr(realpath($root.'/'.$data['config']), strlen($root) + 1);
            $changed = $suite->config !== $data['config'] || ($suite->grep ?? '') !== ($data['grep'] ?? '');
            $ids = [];
            if ($changed) {
                if ($suite->runs()->exists() && ! ($data['reset_history'] ?? false)) {
                    throw ValidationException::withMessages(['reset_history' => 'Confirm resetting this suite’s captures when changing its config or filter.']);
                }
                $ids = $suite->runs()->pluck('id')->all();
                $suite->runs()->delete();
                $suite->test_catalog = null;
                $suite->test_selection = null;
                $suite->selected_tests = null;
            }
            $suite->fill(['name' => $data['name'], 'config' => $data['config'], 'grep' => $data['grep'] ?? null])->save();

            return $ids;
        });
        foreach ($runIds as $id) {
            $preserved = collect($suite->session->fresh()->baseline['runs'] ?? [])->contains('id', $id);
            if (! $preserved) {
                File::deleteDirectory(storage_path('app/private/suites/'.$id));
            }
        }
    }
}
