package com.dialadrink.driver.data.api

import com.google.gson.Gson
import com.google.gson.TypeAdapter
import com.google.gson.stream.JsonReader
import com.google.gson.reflect.TypeToken
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody
import okhttp3.ResponseBody
import okio.Buffer
import retrofit2.Converter
import retrofit2.Retrofit
import java.io.IOException
import java.io.StringReader
import java.lang.reflect.Type

class UnwrappingJsonConverterFactory(
    private val gson: Gson
) : Converter.Factory() {

    override fun requestBodyConverter(
        type: Type,
        parameterAnnotations: Array<Annotation>,
        methodAnnotations: Array<Annotation>,
        retrofit: Retrofit
    ): Converter<*, RequestBody>? {
        val adapter = gson.getAdapter(TypeToken.get(type))
        return RequestConverter(gson, adapter)
    }

    override fun responseBodyConverter(
        type: Type,
        annotations: Array<Annotation>,
        retrofit: Retrofit
    ): Converter<ResponseBody, *>? {
        val adapter = gson.getAdapter(TypeToken.get(type))
        return UnwrappingConverter(gson, adapter)
    }

    private class RequestConverter(
        private val gson: Gson,
        private val adapter: TypeAdapter<*>
    ) : Converter<Any, RequestBody> {

        @Throws(IOException::class)
        override fun convert(value: Any): RequestBody {
            val json = gson.toJson(value)
            val mediaType = "application/json; charset=UTF-8".toMediaType()
            return RequestBody.create(mediaType, json)
        }
    }

    private class UnwrappingConverter(
        private val gson: Gson,
        private val adapter: TypeAdapter<*>
    ) : Converter<ResponseBody, Any> {

        @Throws(IOException::class)
        override fun convert(value: ResponseBody): Any {
            // Read bytes first (before consuming the ResponseBody)
            val bytes = value.bytes()
            
            // Check if it's gzip compressed (magic bytes: 0x1f 0x8b)
            // Bytes are signed in Java/Kotlin, so we need to check unsigned values
            val isGzip = bytes.size >= 2 && 
                (bytes[0].toInt() and 0xFF) == 0x1f && 
                (bytes[1].toInt() and 0xFF) == 0x8b
            
            var raw = if (isGzip) {
                // Decompress gzip
                val gzipStream = java.util.zip.GZIPInputStream(java.io.ByteArrayInputStream(bytes))
                gzipStream.bufferedReader(Charsets.UTF_8).use { it.readText() }.trim()
            } else {
                // Not compressed, read as UTF-8 string
                String(bytes, Charsets.UTF_8).trim()
            }

            // First, try to detect if the response is a stringified JSON
            // Check if it's a JSON string (starts and ends with quotes)
            if (raw.startsWith("\"") && raw.endsWith("\"") && raw.length > 2) {
                // Try to parse it as a JSON string and unwrap
                var maxUnwraps = 10
                while (raw.startsWith("\"") && raw.endsWith("\"") && raw.length > 2 && maxUnwraps > 0) {
                    maxUnwraps--
                    try {
                        val unwrapped = gson.fromJson(raw, String::class.java)
                        if (unwrapped != raw) {
                            raw = unwrapped
                            // If unwrapped is still a stringified JSON, continue
                            if (raw.startsWith("\"") && raw.endsWith("\"")) {
                                continue
                            }
                        }
                        break
                    } catch (e: Exception) {
                        // If Gson can't parse it, manually unwrap
                        raw = raw.substring(1, raw.length - 1)
                            .replace("\\\"", "\"")
                            .replace("\\n", "\n")
                            .replace("\\r", "\r")
                            .replace("\\t", "\t")
                            .replace("\\\\", "\\")
                        break
                    }
                }
            }

            // Now try to parse the unwrapped JSON
            val reader = JsonReader(StringReader(raw))
            reader.isLenient = true
            return try {
                adapter.read(reader) ?: throw IOException("Failed to parse JSON")
            } catch (e: Exception) {
                // If parsing fails, check if raw is still a stringified JSON
                // This can happen if the response is double-stringified
                if (raw.startsWith("\"") && raw.endsWith("\"")) {
                    try {
                        // Try parsing as string first, then parse that string as JSON
                        val stringValue = gson.fromJson(raw, String::class.java)
                        val reader2 = JsonReader(StringReader(stringValue))
                        reader2.isLenient = true
                        return adapter.read(reader2) ?: throw IOException("Failed to parse unwrapped JSON")
                    } catch (e2: Exception) {
                        throw IOException("Failed to parse JSON after unwrapping. Raw starts with: ${raw.take(200)}", e2)
                    }
                }
                throw IOException("Failed to parse JSON. Raw starts with: ${raw.take(200)}", e)
            } finally {
                reader.close()
            }
        }
    }
}
