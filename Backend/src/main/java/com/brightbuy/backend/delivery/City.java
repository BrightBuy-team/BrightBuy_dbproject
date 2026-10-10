package com.brightbuy.backend.delivery;

/** A Texas destination. Main cities get the shorter delivery estimate (BR-8). */
public record City(Integer cityId, String name, Boolean isMainCity) {
}
