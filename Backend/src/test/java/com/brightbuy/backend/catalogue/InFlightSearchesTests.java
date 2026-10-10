package com.brightbuy.backend.catalogue;

import static org.assertj.core.api.Assertions.*;
import java.util.ArrayList;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class InFlightSearchesTests {
    private final InFlightSearches searches = new InFlightSearches();
    private final CatalogueSearch key = new CatalogueSearch("phone", null, null, null, false, "name_asc", 1, 12);

    @Test
    void twoHundredOverlappingSearchesUseOneQuery() throws Exception {
        var entered = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var calls = new AtomicInteger();
        var owner = new FutureTask<String>(() -> searches.execute(key, () -> {
            calls.incrementAndGet(); entered.countDown(); await(release); return "result";
        }));
        Thread ownerThread = new Thread(owner);
        ownerThread.start();
        assertThat(entered.await(5, TimeUnit.SECONDS)).isTrue();
        var threads = new ArrayList<Thread>();
        var followers = new ArrayList<FutureTask<String>>();
        try {
            for (int i = 0; i < 199; i++) {
                var task = new FutureTask<String>(() -> searches.execute(key, () -> {
                    calls.incrementAndGet(); return "unexpected";
                }));
                var thread = new Thread(task);
                threads.add(thread); followers.add(task); thread.start();
            }
            // Wait for the actual join, not an arbitrary sleep: all readers overlap.
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
            while (threads.stream().anyMatch(t -> t.getState() != Thread.State.WAITING)
                    && System.nanoTime() < deadline) Thread.yield();
            assertThat(threads).allMatch(t -> t.getState() == Thread.State.WAITING);
        } finally {
            release.countDown();
        }
        assertThat(owner.get(5, TimeUnit.SECONDS)).isEqualTo("result");
        for (var follower : followers) assertThat(follower.get(5, TimeUnit.SECONDS)).isEqualTo("result");
        assertThat(calls.get()).isEqualTo(1);
        assertThat(searches.execute(key, () -> "fresh stock")).isEqualTo("fresh stock");
    }

    @Test
    void failuresAreNotCachedAndDifferentFiltersDoNotShare() throws Exception {
        var other = new CatalogueSearch("phone", null, null, null, true, "name_asc", 1, 12);
        var entered = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var failure = new IllegalStateException("database unavailable");
        var owner = new FutureTask<String>(() -> searches.execute(key, () -> {
            entered.countDown(); await(release); throw failure;
        }));
        new Thread(owner).start();
        assertThat(entered.await(5, TimeUnit.SECONDS)).isTrue();
        var follower = new FutureTask<String>(() -> searches.execute(key, () -> "unexpected"));
        var thread = new Thread(follower); thread.start();
        try {
            assertThat(searches.execute(other, () -> "different stock filter")).isEqualTo("different stock filter");
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
            while (thread.getState() != Thread.State.WAITING && System.nanoTime() < deadline) Thread.yield();
            assertThat(thread.getState()).isEqualTo(Thread.State.WAITING);
        } finally { release.countDown(); }
        assertThatThrownBy(() -> owner.get(5, TimeUnit.SECONDS)).hasCause(failure);
        assertThatThrownBy(() -> follower.get(5, TimeUnit.SECONDS)).hasCause(failure);
        assertThat(searches.execute(key, () -> "recovered")).isEqualTo("recovered");
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(15, TimeUnit.SECONDS)) throw new IllegalStateException("test timed out");
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt(); throw new IllegalStateException(exception);
        }
    }
}
