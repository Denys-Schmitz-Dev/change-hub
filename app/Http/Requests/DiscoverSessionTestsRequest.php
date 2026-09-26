<?php

namespace App\Http\Requests;

class DiscoverSessionTestsRequest extends StoreTestSuiteRequest
{
    public function rules(): array
    {
        return ['config' => 'required|string|max:500'];
    }
}
