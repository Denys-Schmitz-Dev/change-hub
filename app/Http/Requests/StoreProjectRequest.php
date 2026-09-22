<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['name' => 'required|string|max:120', 'repository_path' => ['required', 'string', function ($attribute, $value, $fail) {
            if (! is_dir($value) || ! file_exists(rtrim($value, '/').'/.git')) {
                $fail('Choose a local Git repository root.');
            }
        }], 'playwright_config' => 'required|string|max:500', 'suite_name' => 'required|string|max:120', 'test_filter' => 'nullable|string|max:200'];
    }

    public function after(): array
    {
        return [function ($validator) {
            if ($this->filled('playwright_config')) {
                $root = realpath($this->input('repository_path'));
                $path = realpath($root.'/'.$this->input('playwright_config'));
                if (! $root || ! $path || ! is_file($path) || ! str_starts_with($path, $root.DIRECTORY_SEPARATOR)) {
                    $validator->errors()->add('playwright_config', 'Choose an existing config inside this repository.');
                }
            }
        }];
    }
}
