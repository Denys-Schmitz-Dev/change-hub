<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['environment_id' => 'required|exists:environments,id', 'title' => 'required|string|max:120', 'path' => ['required', 'string', 'max:500', function ($attribute, $value, $fail) {
            if (! str_starts_with($value, '/') || str_starts_with($value, '//') || str_contains($value, '\\') || preg_match('/[\x00-\x20]/', $value)) {
                $fail('Use a relative page path beginning with a single /.');
            }
        }], 'devices' => 'required|array|min:1|max:2', 'devices.*' => ['distinct', Rule::in(['desktop', 'mobile'])], 'scenarios' => 'required|array|min:1|max:5', 'scenarios.*' => ['distinct', Rule::in(['live', 'guest', 'pending', 'approved', 'denied', 'unavailable'])]];
    }
}
