// ==UserScript==
// @name         WASON各组件AEI数据展示
// @namespace    WASON
// @version      1.2
// @description  通过 API 获取AEI数据并显示在页面顶部
// @author       gmf
// @match        https://aei.rdc.zte.com.cn/
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @downloadURL https://raw.githubusercontent.com/CoCoThink/utils/refs/heads/main/aei.user.js
// @updateURL https://raw.githubusercontent.com/CoCoThink/utils/refs/heads/main/aei.user.js
// ==/UserScript==

(function() {
    'use strict';
    if (window.location.hash !== "#/dashboard") {
        return;
    }

    // 获取今天的日期，格式为 "YYYY-MM-DD"
    function getDate(todayOffset) {
        const today = new Date();
        today.setDate(today.getDate() +todayOffset);
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // 获取今天的日期
    const todayDate = getDate(0);
    const preDate = getDate(-5);

    // 创建顶部栏容器
    const container = document.createElement('div');
    container.id = 'api-data-container';
    document.body.appendChild(container);

    // 创建顶部栏
    const bar = document.createElement('div');
    bar.id = 'api-data-bar';
    bar.innerHTML = '<div id="code-title">代码级<a id="WASON_SC_code_a" href="" target="_blank"><span>&nbsp&nbsp&nbspSC：</span><span id="WASON_SC_code">...</span></a>'+
        '<a id="WASON_PCE_code_a" target="_blank"><span>&nbsp&nbsp&nbspPCE：</span><span id="WASON_PCE_code">...</span></a>'+
        '<a id="WASON_TAP_code_a" target="_blank"><span>&nbsp&nbsp&nbspTAP：</span><span id="WASON_TAP_code">...</span></a>'+
        '<a id="IMS_code_a" target="_blank"><span>&nbsp&nbsp&nbspIMS：</span><span id="IMS_code">...</span></div></a>' +
        '<div id="component-title">组件级<a id="IC_WASON_SC_component_a" target="_blank"><span>&nbsp&nbsp&nbspSC：</span><span id="IC_WASON_SC_component">...</span></a>'+
        '<a id="IC_WASON_PCE_component_a" target="_blank"><span>&nbsp&nbsp&nbspPCE：</span><span id="IC_WASON_PCE_component">...</span></a>'+
        '<a id="IC_WASON_TAP_component_a" target="_blank"><span>&nbsp&nbsp&nbspTAP：</span><span id="IC_WASON_TAP_component">...</span></a>'+
        '<a id="IC_IMS_component_a" target="_blank"><span>&nbsp&nbsp&nbspIMS：</span><span id="IC_IMS_component">...</span></div></a>';

    container.appendChild(bar);

    // 添加样式
    GM_addStyle(`
        #api-data-container {
            position: fixed;
            top: 0;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10000;
            display: flex;
            flex-direction: column;
            align-items: center;
            /*pointer-events: none;*/
        }
        #api-data-bar {
            background-color: rgba(51, 51, 51, 0.8);
            color: white;
            text-align: center;
            padding: 5px 10px;
            font-size: 14px;
            border-radius: 5px;
            white-space: nowrap;
        }
        #code-title, #component-title {
            font-size: 14px;
        }
        .low-score {
            color: red;
        }
    `);

    // 公共函数：发送 POST 请求获取分数
    function fetchScore(metricType) {
        const taskIds = {'code':["86e5b7acca2f44d7a19f6ae4ac905775",
                            "ebfa1a4c321243c9b23423b1f78e5bb7",
                            "31894480fb014f58a8f618468229990a",
                            "b0359d4b8cab45de8b529cd2032faf21"],
                         'component':[
                             "ff7c6cd1ab0c4e93a4343cbf9d640b27",
                             "a39d890f78514517af72047f1d868e82",
                             "e22a08f065934e62a788ae252975ca86",
                             "a35229841d01434fa5370455ed206dc6"
                         ]}
        const req_data = {
            "bodyElem": metricType,
            "spaceNos": [
                "416e565f6fef4e109589d1fc216d8b7b"
            ],
            "taskIds": taskIds[metricType],
            "productNos": [
                "100000429294"
            ],
            "projectNos": [
                "310001263395"
            ],
            "datetimerange": [preDate,todayDate],
            "algorithms": ["master", "shadow"],
            "archMetricDimension": "score"
        }
        GM_xmlhttpRequest({
            method: 'POST',
            url: 'https://aei.rdc.zte.com.cn/config/v1/home/'+metricType+'ResultHistory',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            data: JSON.stringify(req_data),
            onload: function(response) {
                console.log('API 响应:', response.responseText); // 打印响应内容
                if (response.status === 200) {
                    try {
                        const data = JSON.parse(response.responseText);
                        // 获取 list 数据
                        const list = data.body.datas.seriesList;
                        // 使用 for 循环遍历 list
                        for (let i = 0; i < list.length; i++) {
                            const item = list[i];
                            let score =0;
                            let j = 0;
                            for(j=item.data.length-1; j>=0; j--){
                                console.log('score data:', item.data[j]);
                                if(item.data[j] !== null){
                                    score = item.data[j];
                                    break;
                                }
                            }
                            //const score = item.data.slice(-1)[0]
                            console.log('score:', score, 'ID:', item.name+"_"+metricType);
                            const scoreElemId = item.name+"_"+metricType;
                            const scoreValueElement = document.getElementById(scoreElemId);
                            scoreValueElement.textContent = score;
                            if (score < 600) scoreValueElement.classList.add('low-score');
                            const date = getDate(j+1-item.data.length);
                            const url = 'https://aei.rdc.zte.com.cn/#/metricResultDrill?archMetricDimension=score&date='+date+'&blockName='+item.name+'&taskType='+metricType+'&taskId='+data.body.datas.convertDataMap.taskIdClick[i];
                            document.getElementById(scoreElemId+'_a').href = url;
                        }
                    } catch (e) {
                        document.getElementById(metricType+"-title").textContent += '数据解析错误';
                    }
                } else {
                    document.getElementById(metricType+"-title").textContent += 'API 请求失败';
                }
            },
            onerror: function() {
                document.getElementById(metricType+"-title").textContent += '网络错误';
            }
        });
    }

    /*这个API请求失败，不知道为什么*/
    function fetchLastScore(metricType) {
        const taskIds = {'code':["86e5b7acca2f44d7a19f6ae4ac905775",
                            "ebfa1a4c321243c9b23423b1f78e5bb7",
                            "31894480fb014f58a8f618468229990a",
                            "b0359d4b8cab45de8b529cd2032faf21"],
                         'component':[
                             "ff7c6cd1ab0c4e93a4343cbf9d640b27",
                             "a39d890f78514517af72047f1d868e82",
                             "e22a08f065934e62a788ae252975ca86",
                             "a35229841d01434fa5370455ed206dc6"
                         ]}
        const req_data = {
            "taskIds": taskIds[metricType],
            "datetimerange": [preDate,todayDate],
        }
        GM_xmlhttpRequest({
            method: 'POST',
            url: 'https://aei.rdc.zte.com.cn/config/v1/task/queryLastTaskComponentMetricResult',
            anonymous: false,
            headers: { 'Accept': 'application/json, text/plain, */*', 'Content-Type': 'application/json' },
            data: JSON.stringify(req_data),
            onload: function(response) {
                console.log('API 响应:', response.responseText); // 打印响应内容
                if (response.status === 200) {
                    try {
                        const data = JSON.parse(response.responseText);
                        // 获取 list 数据
                        const list = data.body.datas.seriesList;
                        // 使用 for 循环遍历 list
                        for (let i = 0; i < list.length; i++) {
                            const item = list[i];
                            const score = item.data.slice(-1)[0]
                            console.log('score:', score, 'Item Name:', item.name);
                            //console.log('id:', score, 'Item Name:', item.name);
                            const scoreValueElement = document.getElementById(item.name+"_"+metricType);
                            scoreValueElement.textContent = score;
                            if (score < 600) scoreValueElement.classList.add('low-score');
                        }
                    } catch (e) {
                        document.getElementById(metricType+"-title").textContent += '数据解析错误';
                    }
                } else {
                    document.getElementById(metricType+"-title").textContent += 'API 请求失败';
                }
            },
            onerror: function() {
                document.getElementById(metricType+"-title").textContent += '网络错误';
            }
        });
    }

    // 获取代码级分数
    fetchScore('code');
    // 获取组件级分数
    fetchScore('component');
})();
