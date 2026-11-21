package com.localdatatool.toolbox.capture;

import android.os.Build;

import java.io.*;
import java.nio.*;
import java.nio.file.*;

/**
 * Ethernet PCAP output adapted from the operator-supplied collector 1.2.6.
 *
 * 战斗模式（2026-11-08）：文件超过 {@link #TRIM_TRIGGER_BYTES} 时，按 pcap 记录边界把
 * 文件重写成「24B 全局头 + 最近 {@link #TRIM_KEEP_BYTES}」再继续追加，20 分钟采集不会再涨到 20MB+。
 * 被裁掉的那段历史不能再导入完整包，但实时解析靠 JS 侧的 key / 基线继续可用。
 */
public final class PcapWriter implements Closeable {
    /** 超过这个大小开始滚动裁剪。 */
    public static final long TRIM_TRIGGER_BYTES = 8L * 1024 * 1024;
    /** 裁剪后保留的最近一段。 */
    public static final long TRIM_KEEP_BYTES = 4L * 1024 * 1024;
    private final File file;
    private final long limit;
    private final boolean trim;
    private FileOutputStream fileOutput;
    private BufferedOutputStream output;
    private long size = 24;
    private boolean closed;
    /** 找不到记录边界时不反复整份扫描（正常 flush 后不会发生）。 */
    private boolean trimBlocked;
    public PcapWriter(File file, long limit) throws IOException { this(file, limit, false); }
    public PcapWriter(File file, long limit, boolean trim) throws IOException {
        this.file = file;
        this.limit = limit;
        this.trim = trim;
        open(false);
        output.write(ByteBuffer.allocate(24).order(ByteOrder.LITTLE_ENDIAN)
            .putInt(0xa1b2c3d4).putShort((short)2).putShort((short)4).putLong(0).putInt(65535).putInt(1).array());
        size = 24;
    }
    public synchronized boolean append(byte[] ip, long time) throws IOException {
        if (closed) throw new IOException("采集文件已关闭");
        if (ip == null || ip.length == 0) throw new IOException("无效的数据包");
        int length = ip.length + 14;
        if (size + length + 16 > limit) return false;
        output.write(ByteBuffer.allocate(16).order(ByteOrder.LITTLE_ENDIAN)
            .putInt((int)(time / 1000)).putInt((int)((time % 1000) * 1000)).putInt(length).putInt(length).array());
        output.write(new byte[12]);
        output.write((ip[0] >>> 4 & 15) == 6 ? 0x86 : 0x08);
        output.write((ip[0] >>> 4 & 15) == 6 ? 0xdd : 0x00);
        output.write(ip);
        size += length + 16;
        return true;
    }
    public synchronized void flush() throws IOException { if (!closed) output.flush(); }
    public synchronized long flushSnapshot() throws IOException { flush(); return size; }
    /**
     * 战斗模式下超过上限就滚动裁剪；返回当前文件字节数（裁剪后主线程据此发现文件变小）。
     * 裁剪失败不终止采集：重新打开原文件继续追加，本次不再重试，让 128MiB 硬上限兜底。
     */
    public synchronized long trimIfNeeded() throws IOException {
        if (closed || !trim || trimBlocked || size <= TRIM_TRIGGER_BYTES) return size;
        flush();
        long length = file.length();
        long cut = recordStartForKeep(length);
        if (cut <= 24) { trimBlocked = true; return size; }
        File temp = new File(file.getPath() + ".trim");
        try {
            try (RandomAccessFile source = new RandomAccessFile(file, "r");
                 FileOutputStream destination = new FileOutputStream(temp)) {
                byte[] header = new byte[24];
                source.readFully(header);
                destination.write(header);
                source.seek(cut);
                byte[] buffer = new byte[65536];
                long remaining = length - cut;
                while (remaining > 0) {
                    int read = source.read(buffer, 0, (int)Math.min(buffer.length, remaining));
                    if (read < 0) break;
                    destination.write(buffer, 0, read);
                    remaining -= read;
                }
                destination.getFD().sync();
            }
            output.close();
            replaceFile(temp, file);
            open(true);
            // 标记只用于拒绝「完整导入」；写失败不影响继续采集
            try { CaptureFiles.markTrimmed(file); } catch (IOException ignored) { }
        } catch (IOException error) {
            temp.delete();
            try { output.close(); } catch (IOException ignored) { }
            open(true);
            trimBlocked = true;
            return size;
        }
        return size;
    }
    /** 原子替换：网页可能正在按旧快照读文件，不能出现「半个文件」。 */
    private static void replaceFile(File source, File target) throws IOException {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            replaceFileNio(source, target);
            return;
        }
        if (source.renameTo(target)) return;

        // Android 6/7 没有 java.nio.file；同目录 rename 通常是原子的，只在实现拒绝覆盖时兜底。
        File backup = new File(target.getPath() + ".rename-backup");
        if (backup.exists() || (target.exists() && !target.renameTo(backup))) {
            throw new IOException("无法替换采集文件");
        }
        if (!source.renameTo(target)) {
            if (backup.exists()) backup.renameTo(target);
            throw new IOException("无法替换采集文件");
        }
        if (backup.exists() && !backup.delete()) {
            throw new IOException("无法清理采集文件备份");
        }
    }
    @android.annotation.TargetApi(Build.VERSION_CODES.O)
    private static void replaceFileNio(File source, File target) throws IOException {
        try {
            Files.move(source.toPath(), target.toPath(),
                StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException fallback) {
            Files.move(source.toPath(), target.toPath(), StandardCopyOption.REPLACE_EXISTING);
        }
    }
    /** 第一条「保留区间起点」记录：最后一段不超过 keep 字节的完整记录起点。 */
    private long recordStartForKeep(long length) throws IOException {
        long target = length - TRIM_KEEP_BYTES;
        if (target <= 24) return 0;
        try (RandomAccessFile source = new RandomAccessFile(file, "r")) {
            byte[] header = new byte[16];
            long offset = 24;
            while (offset + 16 <= length) {
                source.seek(offset);
                source.readFully(header);
                long captured = (header[8] & 0xffL) | ((header[9] & 0xffL) << 8)
                    | ((header[10] & 0xffL) << 16) | ((header[11] & 0xffL) << 24);
                long next = offset + 16 + captured;
                if (captured < 0 || next <= offset || next > length) return 0;
                if (offset >= target) return offset;
                offset = next;
            }
        }
        return 0;
    }
    /** 打开输出流；append=false 清空重写，append=true 从末尾继续追加。 */
    private void open(boolean append) throws IOException {
        fileOutput = new FileOutputStream(file, append);
        output = new BufferedOutputStream(fileOutput, 65536);
        size = file.length();
    }
    @Override public synchronized void close() throws IOException {
        if (closed) return;
        closed = true;
        try { output.flush(); fileOutput.getFD().sync(); } finally { output.close(); }
    }
}
