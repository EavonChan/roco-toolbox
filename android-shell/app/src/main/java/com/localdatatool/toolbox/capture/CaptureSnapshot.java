package com.localdatatool.toolbox.capture;

import java.io.*;

/** A read grant ends at a flushed PCAP record boundary, even as capture continues. */
final class CaptureSnapshot {
    final File file;
    final long size;
    final String session;
    CaptureSnapshot(File file, long size, String session) { this.file = file; this.size = size; this.session = session; }

    InputStream open() throws IOException {
        return open(0);
    }

    /**
     * 从 {@code from} 字节处开始读到快照末尾。
     *
     * 实时巡检每一轮都重读整个文件太慢（文件涨到几十 MB 后，搬运占了绝大部分耗时），
     * 网页侧会记住已读位置，只取新增的一段（2026-11-08）。
     */
    InputStream open(long from) throws IOException {
        if (from < 0 || from > size) throw new IOException("invalid capture range");
        FileInputStream input = new FileInputStream(file);
        long skipped = 0;
        while (skipped < from) {
            long count = input.skip(from - skipped);
            if (count <= 0) throw new EOFException("采集快照未完整保存，请稍后重试");
            skipped += count;
        }
        final long length = size - from;
        return new FilterInputStream(input) {
            private long remaining = length;
            @Override public int read() throws IOException {
                if (remaining == 0) return -1;
                int value = in.read();
                if (value < 0) throw new EOFException("采集快照未完整保存，请稍后重试");
                remaining--; return value;
            }
            @Override public int read(byte[] buffer, int offset, int length) throws IOException {
                if (length == 0) return 0;
                if (remaining == 0) return -1;
                int count = in.read(buffer, offset, (int)Math.min(remaining, length));
                if (count < 0) throw new EOFException("采集快照未完整保存，请稍后重试");
                remaining -= count; return count;
            }
            @Override public long skip(long count) throws IOException {
                long skipped = in.skip(Math.min(remaining, Math.max(0, count)));
                remaining -= skipped; return skipped;
            }
            @Override public int available() throws IOException { return (int)Math.min(remaining, in.available()); }
        };
    }
}
