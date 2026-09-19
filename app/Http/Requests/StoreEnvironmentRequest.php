<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreEnvironmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => 'required|string|max:120', 'base_url' => ['required', 'url:http,https', 'max:500', function ($attribute, $value, $fail) {
                $url = parse_url($value);
                if (isset($url['user']) || isset($url['pass']) || isset($url['query']) || isset($url['fragment']) || (isset($url['path']) && ! in_array($url['path'], ['', '/']))) {
                    $fail('Use an origin such as http://127.0.0.1:5175, without a path or credentials.');
                }
            }],
            'ready_selector' => 'nullable|string|max:300', 'allowed_origins' => 'nullable|string|max:2000', 'runner_mode' => ['required', Rule::in(['local', 'docker'])], 'docker_network' => ['nullable', 'required_if:runner_mode,docker', 'regex:/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,100}$/'], 'profile' => ['required', Rule::in(['live', 'resume'])],
        ];
    }

    public function after(): array
    {
        return [function ($validator) {
            foreach (preg_split('/\s+/', trim($this->input('allowed_origins', '') ?? ''), -1, PREG_SPLIT_NO_EMPTY) as $origin) {
                $parts = parse_url($origin);
                if (! filter_var($origin, FILTER_VALIDATE_URL) || ! in_array($parts['scheme'] ?? '', ['http', 'https']) || isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment']) || ! in_array($parts['path'] ?? '', ['', '/'])) {
                    $validator->errors()->add('allowed_origins', 'Enter one HTTP origin per line, with no paths or credentials.');
                }
            }
        }];
    }
}
