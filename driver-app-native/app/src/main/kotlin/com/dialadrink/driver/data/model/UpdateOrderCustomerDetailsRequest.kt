package com.dialadrink.driver.data.model

data class UpdateOrderCustomerDetailsRequest(
    val customerName: String? = null,
    val customerPhone: String? = null,
    val deliveryAddress: String? = null
)

