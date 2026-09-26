<?php

namespace App\Http\Requests;

use Illuminate\Validation\Validator;

class UpdateTestSuiteRequest extends StoreTestSuiteRequest
{
    public function rules(): array
    {
        return parent::rules() + ['reset_history' => 'sometimes|boolean'];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->has('config')) {
                return;
            }
            $root = realpath($this->route('suite')->session->profile['repository']);
            $path = $root ? realpath($root.'/'.$this->input('config')) : false;
            if (! $root || ! $path || ! is_file($path) || ! str_starts_with($path, $root.DIRECTORY_SEPARATOR)) {
                $validator->errors()->add('config', 'Choose a Playwright config inside the connected repository.');
            }
        }];
    }
}
