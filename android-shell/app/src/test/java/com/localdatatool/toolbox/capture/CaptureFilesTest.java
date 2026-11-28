package com.localdatatool.toolbox.capture;

import org.junit.Test;
import org.junit.Rule;
import org.junit.rules.TemporaryFolder;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import static org.junit.Assert.*;

public class CaptureFilesTest {
    @Rule public TemporaryFolder temp = new TemporaryFolder();
    @Test public void rejectPathsAndUnknownFiles() throws Exception {
        CaptureFiles files = new CaptureFiles(temp.newFolder());
        for (String id : new String[]{"../x", "capture-1.pcap/../x", "x.pcap", "capture-1.pcap"}) {
            try { files.require(id); fail(id); } catch (IOException expected) { }
        }
    }
    @Test public void interruptedCaptureRemainsVisibleButNotImportable() throws Exception {
        File directory = temp.newFolder();
        CaptureFiles files = new CaptureFiles(directory);
        File file = files.create();
        try (PcapWriter writer = new PcapWriter(file, 1024)) { writer.append(ipv4(), 1000); }
        CaptureFiles recovered = new CaptureFiles(directory);
        assertEquals(1, recovered.list().size());
        assertFalse(recovered.valid(file));
        recovered.complete(file);
        assertTrue(recovered.valid(file));
    }
    @Test public void noAutomaticDeletionAtFileLimit() throws Exception {
        CaptureFiles files = new CaptureFiles(temp.newFolder());
        for (int i = 0; i < 10; i++) files.create();
        try { files.create(); fail("must require user cleanup"); } catch (IOException expected) { }
        assertEquals(10, files.list().size());
    }
    @Test public void pcapLimitNeverWritesHalfARecord() throws Exception {
        File file = temp.newFile();
        try (PcapWriter writer = new PcapWriter(file, 70)) {
            assertTrue(writer.append(ipv4(), 1000));
            assertFalse(writer.append(ipv4(), 1001));
        }
        assertEquals(68, file.length()); // 24 + 16 + Ethernet14 + IP14
    }
    @Test public void battleModeTrimsToRecentRecordsOnLimit() throws Exception {
        File file = temp.newFile();
        byte[] ip = new byte[1000];
        ip[0] = 0x45;
        long time = 1000;
        try (PcapWriter writer = new PcapWriter(file, CaptureFiles.MAX_BYTES, true)) {
            assertEquals("新文件代次从 0 开始", 0, writer.generation());
            // 每条记录 16 + 1000 + 14 = 1030 字节，8300 条约 8.5MiB
            for (int index = 0; index < 8300; index++) assertTrue(writer.append(ip, time++));
            long before = writer.flushSnapshot();
            long after = writer.trimIfNeeded();
            assertEquals(file.length(), after);
            assertTrue("trim 后应明显变小", after < before);
            assertTrue("只保留最近一段", after <= PcapWriter.TRIM_KEEP_BYTES + 1030 + 24);
            assertTrue(after > 24);
            assertEquals("裁剪成功要换一代，网页据此整份重读", 1, writer.generation());
            assertPcapRecords(file);
            assertTrue(new File(file.getPath() + ".trimmed").isFile());
            // 裁剪后仍能继续追加，且还是合法 pcap
            assertTrue(writer.append(ip, time));
            // 没到阈值再调一次不能凭空换代
            writer.trimIfNeeded();
            assertEquals(1, writer.generation());
        }
        assertPcapRecords(file);
    }
    @Test public void trimmedMarkerBlocksImportAndIsDeletedWithFile() throws Exception {
        CaptureFiles files = new CaptureFiles(temp.newFolder());
        File file = files.create();
        try (PcapWriter writer = new PcapWriter(file, 1024)) { writer.append(ipv4(), 1000); }
        files.complete(file);
        assertFalse(files.trimmed(file));
        CaptureFiles.markTrimmed(file);
        assertTrue(files.trimmed(file));
        files.delete(file.getName());
        assertFalse(new File(file.getPath() + ".trimmed").exists());
    }
    /** 从文件头按记录头逐条验证长度，最后一条必须正好结束在文件末尾。 */
    private static void assertPcapRecords(File file) throws Exception {
        try (java.io.RandomAccessFile source = new java.io.RandomAccessFile(file, "r")) {
            long length = source.length();
            byte[] header = new byte[16];
            long offset = 24;
            int records = 0;
            while (offset + 16 <= length) {
                source.seek(offset);
                source.readFully(header);
                long captured = (header[8] & 0xffL) | ((header[9] & 0xffL) << 8)
                    | ((header[10] & 0xffL) << 16) | ((header[11] & 0xffL) << 24);
                long next = offset + 16 + captured;
                assertTrue("记录不能越界", next <= length);
                offset = next;
                records++;
            }
            assertEquals("文件必须结束在记录边界", length, offset);
            assertTrue(records > 0);
        }
    }
    @Test public void deletingFileAlsoRemovesInterruptionMarker() throws Exception {
        CaptureFiles files = new CaptureFiles(temp.newFolder());
        File file = files.create();
        files.delete(file.getName());
        assertEquals(0, files.list().size());
        assertFalse(new File(file + ".incomplete").exists());
    }
    @Test public void symbolicLinksCannotEscapeCaptureDirectory() throws Exception {
        File root = temp.newFolder();
        File external = temp.newFile();
        try {
            java.nio.file.Files.createSymbolicLink(new File(root, "capture-1.pcap").toPath(), external.toPath());
        } catch (UnsupportedOperationException | IOException denied) { return; }
        try { new CaptureFiles(root).require("capture-1.pcap"); fail("escaped"); }
        catch (IOException expected) { }
    }
    private static byte[] ipv4() { byte[] ip = new byte[14]; ip[0] = 0x45; return ip; }
}
