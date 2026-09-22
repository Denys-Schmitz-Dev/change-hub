<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateSuiteVideoRequest extends FormRequest
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
            'mode' => 'required|in:all,selected',
            'selected_tests' => 'sometimes|array|max:5000',
            'selected_tests.*' => 'required|string|regex:/^[a-f0-9]{64}$/|distinct',
        ];
    }
}
