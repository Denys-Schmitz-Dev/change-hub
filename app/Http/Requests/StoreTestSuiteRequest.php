<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreTestSuiteRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => 'required|string|max:120',
            'config' => 'required|string|max:500',
            'grep' => 'nullable|string|max:200',
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->has('config')) {
                return;
            }
            $root = realpath($this->route('session')->profile['repository']);
            $path = $root ? realpath($root.'/'.$this->input('config')) : false;
            if (! $root || ! $path || ! is_file($path) || ! str_starts_with($path, $root.DIRECTORY_SEPARATOR)) {
                $validator->errors()->add('config', 'Choose a Playwright config inside the connected repository.');
            }
        }];
    }
}
