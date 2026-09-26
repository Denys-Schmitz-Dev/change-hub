<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreReviewApprovalRequest extends FormRequest
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
        $rules = [
            'run_id' => 'required|integer|exists:suite_runs,id',
            'file' => 'required|string|max:1000',
        ];
        if (! $this->isMethod('DELETE')) {
            $rules['reason'] = 'required|in:covered_elsewhere,no_test_needed,manually_verified,other';
            $rules['note'] = 'nullable|string|max:1000';
        }

        return $rules;
    }
}
