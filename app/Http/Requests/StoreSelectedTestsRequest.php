<?php

namespace App\Http\Requests;

class StoreSelectedTestsRequest extends DiscoverSessionTestsRequest
{
    public function rules(): array
    {
        return parent::rules() + [
            'name' => 'required|string|max:120',
            'test_keys' => 'required|array|min:1|max:500',
            'test_keys.*' => 'required|string|regex:/^[a-f0-9]{64}$/|distinct',
        ];
    }
}
