#!/usr/bin/env python3
"""
测试 ccr.json 中配置的各大模型API可用性
"""

import json
import os
import requests
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Optional


@dataclass
class TestResult:
    provider: str
    model: str
    status: str
    response_time: float
    error_msg: str = ""


def load_config(path: str = "~/.claude-code-router/config.json") -> dict:
    """加载配置文件"""
    expanded_path = os.path.expanduser(path)
    with open(expanded_path, "r", encoding="utf-8") as f:
        return json.load(f)


def test_openai_compatible(provider: dict, model: str) -> TestResult:
    """测试OpenAI兼容格式的API"""
    start_time = time.time()
    provider_name = provider["name"]
    api_base = provider["api_base_url"]
    api_key = provider["api_key"]

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": "Hi"}],
        "max_tokens": 10
    }

    try:
        response = requests.post(
            api_base,
            headers=headers,
            json=payload,
            timeout=30
        )
        elapsed = time.time() - start_time

        if response.status_code == 200:
            return TestResult(provider_name, model, "✅ 可用", elapsed)
        else:
            error = response.json().get("error", {}).get("message", f"HTTP {response.status_code}")
            return TestResult(provider_name, model, "❌ 失败", elapsed, error)
    except requests.exceptions.Timeout:
        return TestResult(provider_name, model, "⏱️ 超时", time.time() - start_time, "请求超时(30s)")
    except Exception as e:
        return TestResult(provider_name, model, "❌ 错误", time.time() - start_time, str(e)[:50])


def test_gemini(provider: dict, model: str) -> TestResult:
    """测试Google Gemini API"""
    start_time = time.time()
    provider_name = provider["name"]
    api_key = provider["api_key"]

    url = f"{provider['api_base_url']}{model}:generateContent?key={api_key}"

    payload = {
        "contents": [{"parts": [{"text": "Hi"}]}],
        "generationConfig": {"maxOutputTokens": 10}
    }

    try:
        response = requests.post(url, json=payload, timeout=30)
        elapsed = time.time() - start_time

        if response.status_code == 200:
            return TestResult(provider_name, model, "✅ 可用", elapsed)
        else:
            error = response.json().get("error", {}).get("message", f"HTTP {response.status_code}")
            return TestResult(provider_name, model, "❌ 失败", elapsed, error)
    except requests.exceptions.Timeout:
        return TestResult(provider_name, model, "⏱️ 超时", time.time() - start_time, "请求超时(30s)")
    except Exception as e:
        return TestResult(provider_name, model, "❌ 错误", time.time() - start_time, str(e)[:50])


def test_model(provider: dict, model: str) -> TestResult:
    """根据provider类型选择测试方法"""
    if "gemini" in provider["name"].lower():
        return test_gemini(provider, model)
    else:
        return test_openai_compatible(provider, model)


def print_table(results: list[TestResult]):
    """打印美观的表格"""
    # 计算列宽
    p_width = max(len(r.provider) for r in results) + 2
    m_width = max(len(r.model) for r in results) + 2
    s_width = max(len(r.status) for r in results) + 2

    p_width = max(p_width, 12)
    m_width = max(m_width, 20)
    s_width = max(s_width, 10)

    # 表头
    header = f"| {'Provider':^{p_width}} | {'Model':^{m_width}} | {'Status':^{s_width}} | {'Time(s)':^10} | {'Error':^30} |"
    separator = "|" + "-" * (p_width + 2) + "|" + "-" * (m_width + 2) + "|" + "-" * (s_width + 2) + "|" + "-" * 12 + "|" + "-" * 32 + "|"

    print("\n" + "=" * len(header))
    print("🤖 大模型API可用性测试结果")
    print("=" * len(header))
    print(header)
    print(separator)

    # 按provider分组排序
    current_provider = ""
    for r in sorted(results, key=lambda x: (x.provider, x.model)):
        # 不同provider之间加空行
        if current_provider and current_provider != r.provider:
            print(separator)
        current_provider = r.provider

        provider_display = r.provider if r.provider != current_provider else ""
        time_str = f"{r.response_time:.2f}"
        error_str = r.error_msg[:28] + ".." if len(r.error_msg) > 30 else r.error_msg

        row = f"| {r.provider:^{p_width}} | {r.model:^{m_width}} | {r.status:^{s_width}} | {time_str:^10} | {error_str:^30} |"
        print(row)

    print(separator)

    # 统计
    total = len(results)
    available = sum(1 for r in results if "✅" in r.status)
    failed = sum(1 for r in results if "❌" in r.status)
    timeout = sum(1 for r in results if "⏱️" in r.status)

    print(f"\n📊 统计: 总计 {total} | ✅ 可用 {available} | ❌ 失败 {failed} | ⏱️ 超时 {timeout}")
    print()


def main():
    print("🔍 正在加载配置...")
    config = load_config()
    providers = config.get("Providers", [])

    print(f"📋 发现 {len(providers)} 个Provider")

    # 收集所有需要测试的(provider, model)组合
    tasks = []
    for provider in providers:
        # 去重模型
        seen = set()
        for model in provider.get("models", []):
            if model not in seen:
                seen.add(model)
                tasks.append((provider, model))

    print(f"🧪 共 {len(tasks)} 个模型需要测试\n")

    # 并发测试
    results = []
    with ThreadPoolExecutor(max_workers=5) as executor:
        future_to_task = {
            executor.submit(test_model, p, m): (p, m)
            for p, m in tasks
        }

        for future in as_completed(future_to_task):
            result = future.result()
            results.append(result)
            print(f"  {'✓' if '✅' in result.status else '✗'} {result.provider}/{result.model}: {result.status}")

    # 打印结果表格
    print_table(results)


if __name__ == "__main__":
    main()
