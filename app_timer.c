/*****************************************************************
*
*           COPYRIGHT (c) 2017 Nihon Systemware Co.ltd.
*                        All Rights Reserved
*
* Description : for TIMER Control.
*
******************************************************************/

/*****************************************************************
  * File Inclusions
  *****************************************************************/
// 
#include <string.h>

// HAL
#include "hal_tz.h"
#include "hal_dk_timer.h"
#include "user_data.h"
#include "systeminfo.h"
#include "hal_data_flash.h"

// APP
#include "app_event.h"
#include "app_timer.h"
#include "app_serialcomm_if.h"
#include "app_timesync.h"
#include "app_mqtt.h"
#include "app_polling.h"
#include "app_json.h"
#include "condition_compile.h"
#include "app_httpc_local.h"
#include "httpd_interface.h"
/**
 ******************************************************************************
 * @file app_hal_timer.c
******************************************************************************/

/*****************************************************************************
  *  Public Variables
  ****************************************************************************/
BIGDATA_DEFINITION_T bigdata_definition = {0};
extern HTTPC_FIRMWARE_LIST_T httpc_firmware_list;


/*****************************************************************************
  *  Private definition
  ****************************************************************************/
#define TIMEOUT_T_TIMER_MONI    (TIMEOUT_VALUE_1SEC * 20)        // 設定温度プログラム・タイマー情報 タイマ・タイムアウト値.
#define TIMEOUT_GET_EVENT_DEFINE_MONI    ((24*60*60*1000) / TIMEOUT_T_TIMER_MONI)
#define TIMEOUT_GET_DEVICE_DATA_CYCLE_MONI    ((24*60*60*1000) / TIMEOUT_T_TIMER_MONI)
#define FW_CHECK_OFFSET	0	//FW更新情報チェック時刻のオフセット(ローカル時刻0時からの経過秒数)
#define FW_CHECK_PERIOD	(6 * 60 * 60)	//FW更新情報チェック期間(オフセットからの秒数)
#define FW_CHECK_BUFFER_SECOND 25 //FW更新情報チェック時間バッファ秒。チェック時刻から前後にズレても良い秒数
#define FW_NO_CHECKING_VALUE  (FW_CHECK_BUFFER_SECOND * 4)//FW更新情報チェック時間から外れた場合、変数へ入れる値。

/*****************************************************************************
  *  Private Variables
  ****************************************************************************/
// タイマ・インスタンス.
static HalTimerElem	gTimerControlTimer = {
	0,
	"ap_tmr",
	HAL_TIMER_MODE_ONESHOT,
	TIMEOUT_T_TIMER_MONI
};

int16_t LastSendMinuteOnOffTimer;
static bool check_sec_flg = false;				// true:FW取得のチェック秒を手動設定する	false:FW取得のチェック秒を手動設定しない
static struct tm check_sec = { 0 };				// FW取得のチェック秒を手動設定した際のtm構造体
static bool offset_sec_flg = false;				// true:FW取得のオフセット秒を手動設定する	false:FW取得のオフセット秒を手動設定しない
static struct tm offset_sec = { 0 };			// FW取得のオフセット秒を手動設定した際のtm構造体
static bool offset_datetime_flg = false;		// true:FW取得時の現在日を手動設定する		false:FW取得の現在日を手動設定しない
static struct tm offset_datetime = { 0 };		// FW取得時の現在日を手動設定した際のtm構造体
static bool fw_macadr_flg = false;				// true:FW取得時のMacアドレスを手動設定する	false:FW取得時のMacアドレスを手動設定しない
static uint8_t fw_macadr[6] = {0};				// FW取得時のMacアドレスを手動設定した際の手動設定Macアドレス	
/*****************************************************************************
  *  Private Functions Declarations.
  *****************************************************************************/



/*****************************************************************************
  *  Private Functions.
  *****************************************************************************/

/******************************************************************
 * 機能: TIMER制御タイマ・タイムアウトハンドラ：各機器共通
 *			イベントは各機器のメインスレッドで受信される.
 * 引数: unused 未使用
 * 戻値: none
 ******************************************************************/
static void DkTimer_timeoutTimeCheck(void *unused)
{
	// Mainスレッドへイベントを投げる.
	AppMain_Notify_Event(APP_EVENT_CHECK_TIMER);
	Hal_StartTimerElem(&gTimerControlTimer, TIMEOUT_T_TIMER_MONI);    // タイマ起動.
}


/*****************************************************************************
  *  Public Functions.
  *****************************************************************************/

/******************************************************************
 * 機能: タイマー初期化：各機器共通
 * 引数: none
 * 戻値: none
 ******************************************************************/
void DkTimer_Initialize(void)
{
	Hal_InitializeTimerElem(&gTimerControlTimer, DkTimer_timeoutTimeCheck, NULL);
	// 機器履歴データpal_mutex生成処理(No.6と8で使用する) mutexのハンドル作られて、グローバル初期値をnullで宣言(nullか否かをNo8でチェック)
	// ※deleteが必要な場合にどこで削除するか
	// ★削除場所がない場合は...(deleteはアダプタが動き続けているので、止まるときは異常時になる想定。そもそもタイマーをdeleteする処理がない。)
}

/******************************************************************
 * 機能: タイマの起動：各機器共通
 * 引数: none
 * 戻値: none
 ******************************************************************/
void DkTimer_StartTimerController(void)
{
	LastSendMinuteOnOffTimer = -1;
	Hal_StartTimerElem(&gTimerControlTimer, TIMEOUT_T_TIMER_MONI);
}



#define TIMER_BACK_CHECK_COUNT	5	// チェック分数
/******************************************************************
 * 機能: 時刻同期時に時間が進んだ場合に飛び越したタイマーを動作させる.
 * 引数: none
 * 戻値: none
 ******************************************************************/
void DkTimer_CheckPassedTimer(ExecutePassedTimerFunc func)
{
	uint16_t currentTime;
	struct tm cur_time;
	struct tm bef_time;
	time_t cur_time_sec;
	time_t bef_time_sec;
	int i;
	int check_end = 0;

	if ((!sysinfo_isFunctionEnable(SYS_CONFIG_FUNC_SCHEDULE_TIMER)) ||
		(!AppSerial_isCommOK()))
	{
		// タイマー機能がない、無効時またはシリアル通信出来ていない場合は処理の必要なし
		return;
	}

	bef_time_sec = DkTimeSync_GetBeforeUpdateTime();
	if (bef_time_sec != 0) {
		// 時刻同期で時間が更新されたならチェック
		Hal_GetLocalTM(&cur_time, 0);			// 現在時刻を取得
		cur_time_sec = mktime(&cur_time);		// secに変換
		// 未来方向へ20秒以上進んで同期した場合のみ(タイマーで20秒間隔でチェックしているので20秒以内の進みは意識しなくてOK)
		if (cur_time_sec > (bef_time_sec + 20)) {
			Hal_StopTimerElem(&gTimerControlTimer);		// ここでUpしているタイマーを実行させるかもなので監視タイマーは一時停止
			gmtime_r((const time_t *)&bef_time_sec, &bef_time);	// TM構造体に変換する
			// 秒単位は落とす
			cur_time_sec /= 60;
			bef_time_sec /= 60;
			for (i = 0; i <= TIMER_BACK_CHECK_COUNT; i++) {
				currentTime = ((cur_time.tm_hour * 60) + cur_time.tm_min);
				if (cur_time_sec == bef_time_sec) {	// 同期前と同時刻なので最終.
					// 同じ時間なのでチェック済みであれば何もしない
					if (currentTime == LastSendMinuteOnOffTimer) {
						// 既にチェック済みなので終了
						break;
					}
					// これより前の時間のチェックは不要なので処理後に終了するよう設定
					check_end = 1;
				}
				// check
				if (func(currentTime, cur_time.tm_wday)) {
					// この時間の処理は実行したので設定しておく、現在時間が動作させた時間より未来であれば次のタイムアップで処理される.
					LastSendMinuteOnOffTimer = currentTime;
					break;
				}

				// 次のチェック時間を設定、時間と曜日のみ必要なので日時は気にしない
				if (cur_time.tm_min != 0) {
					cur_time.tm_min--;
				} else {
					cur_time.tm_min = 59;
					if (cur_time.tm_hour != 0) {
						cur_time.tm_hour--;
					} else {
						cur_time.tm_hour = 23;
						if (cur_time.tm_wday == 0) {
							cur_time.tm_wday = 6;
						} else {
							cur_time.tm_wday--;
						}
					}
				}
				cur_time_sec--;	// 分単位にしているので-1でOK
				if (check_end == 1) {
					break;
				}
			}
			Hal_StartTimerElem(&gTimerControlTimer, TIMEOUT_T_TIMER_MONI);	// 監視タイマーを再開
		}
	}
}

// 日付跨ぎ時にログを採取する。
uint8_t gLastCheckHour = 0xFF;
void DkTimer_LogWrite(void)
{
	struct tm  localTime;
	// 現在設定されている時刻情報を取得
	Hal_GetLocalTM_ECost(&localTime, 0);
	if (gLastCheckHour != localTime.tm_hour) {
		if (localTime.tm_hour == 0) {
			// 日付が変わったのでログを採取.(起動後最初の0時台にログ採取)
			Hal_DataFlash_AdpLog_Write("The date has changed", INDICATE_EVENT_LOG, 0);
		}
		gLastCheckHour = localTime.tm_hour;
	}
}

/**
 * @brief イベント定義情報取得要求再送判定
 * 
 */
void MqttGetEventDefineProcessCheck(void)
{
	if (check_get_event_define_cnt >= TIMEOUT_GET_EVENT_DEFINE_MONI) 
	{
		// MQTT接続中
		if (App_Mqtt_getConnectState() == 1)
		{
			DkUdpCmd_SendLog("[24H] MQTT_COMMAND__GET_EVENT_DEFINE_INFO", LOG_LEVEL_VERBOSE);
			// イベント定義情報を取得
			App_Mqtt_SendCommand(MQTT_COMMAND__GET_EVENT_DEFINE_INFO);
			check_get_event_define_cnt = 0;
		}
		else{
			DkUdpCmd_SendLog("[24H] MQTT_COMMAND__GET_EVENT_DEFINE_INFO - MQTT Not Connect", LOG_LEVEL_VERBOSE);
		} 
	}
	else
	{
		check_get_event_define_cnt++;
	}
}

/**
 * @brief 機器情報取得周期情報取得再送判定
 * 
 */
void MqttGetDeviceDataCycleProcessCheck(void)
{

	if (check_get_device_data_cycle_cnt >= TIMEOUT_GET_DEVICE_DATA_CYCLE_MONI) 
	{
		// MQTT接続中
		if (App_Mqtt_getConnectState() == 1)
		{
			DkUdpCmd_SendLog("[24H] MQTT_COMMAND__GET_DEVICE_DATA_CYCLE", LOG_LEVEL_VERBOSE);
			// 機器データ取得周期を取得
			App_Mqtt_SendCommand(MQTT_COMMAND__GET_DEVICE_DATA_CYCLE);
			check_get_device_data_cycle_cnt = 0;
		}
		else{
			DkUdpCmd_SendLog("[24H] MQTT_COMMAND__GET_DEVICE_DATA_CYCLE - MQTT Not Connect", LOG_LEVEL_VERBOSE);
		}
	}
	else
	{
		check_get_device_data_cycle_cnt++;
	}
}

void MqttGetDeviceDataProcessCheck(void)
{
	BIGDATA_DEFINITION_UNIT_T* other_unit_array[] = {
		&bigdata_definition.edge.adp_i,
		&bigdata_definition.edge.adp_d,
		&bigdata_definition.edge.dev_i,
		&bigdata_definition.edge.adp_r,
		&bigdata_definition.edge.adp_f,
		&bigdata_definition.device.price,
		&bigdata_definition.device.target,
		&bigdata_definition.device.scdl_t,
		&bigdata_definition.device.demand,
		&bigdata_definition.device.patrol,
		&bigdata_definition.device.i_power,
	};

	static uint32_t dgc_timer_count[DGC_ENTITY_MAX] = {0};
	static uint32_t other_timer_count[ (sizeof(other_unit_array)/sizeof(int)) ] = {0};

	const bool model_init = bigdata_definition.modelinfo_initialized;
	const bool definition_receive = bigdata_definition.receive_defined_data;

	if ((model_init == true) && (definition_receive == true) && (isFWUpdate() == false))
	{
		// 今回取得するデータが1つ以上あるか否か
		bool this_time_get_data = false;

		// データ取得カウント処理の累計動作回数
		static uint32_t total_processing_count = 0;
		total_processing_count++;

		uint32_t* current_timer;
		int index_max;

		// DGCカウント処理
		BIGDATA_DEFINITION_DGC_T* dgc_unit = &bigdata_definition.dgc_status[0];
		current_timer = &dgc_timer_count[0];
		index_max = bigdata_definition.max_dgc_entity_count;
		for (int index = 0; index < index_max; index++)
		{
			(*current_timer)++;

			if (total_processing_count == 1)
			{
				dgc_unit->get_data = true;
				this_time_get_data = true;
			}
			else if ((dgc_unit->timer_cycle != 0) && ((*current_timer) >= dgc_unit->timer_cycle))
			{
				dgc_unit->get_data = true;
				this_time_get_data = true;
				*current_timer = 0;
			}
			else
			{
				dgc_unit->get_data = false;
			}

			dgc_unit++;
			current_timer++;
		}

		// その他カウント処理
		current_timer = &other_timer_count[0];
		index_max = (sizeof(other_unit_array)/sizeof(int));
		for (int index = 0; index < index_max; index++)
		{
			(*current_timer)++;

			if (total_processing_count == 1)
			{
				other_unit_array[index]->get_data = true;
				this_time_get_data = true;
			}
			else if ((other_unit_array[index]->timer_cycle != 0) && ((*current_timer) >= other_unit_array[index]->timer_cycle))
			{
				other_unit_array[index]->get_data = true;
				this_time_get_data = true;
				*current_timer = 0;
			}
			else
			{
				other_unit_array[index]->get_data = false;
			}

			current_timer++;
		}

		if (this_time_get_data)
		{
			// データ取得・蓄積処理
			JsonData_CreateBigdata();

#ifdef DEBUG_BIGDATA_LOGOUTPUT
			JsonData_debugNodeDataExchange(device_rsc_contens_buf, 4);
#endif
			// ヒストリーデータ作成
			DkPolling_makeHistoryData();

			if (total_processing_count == 1)
			{
				enServerSnd = true;
			}
		}
	}
}

void MqttSendDeviceHistoryDataProcessCheck(void)
{
	const bool model_init = bigdata_definition.modelinfo_initialized;
	const bool definition_receive = bigdata_definition.receive_defined_data;

	if ((model_init == true) && (definition_receive == true) && (isFWUpdate() == false))
	{
		static uint32_t current_timer_count = 0;
		current_timer_count++;

		if (current_timer_count >= bigdata_definition.server_timer_cycle)
		{
			enServerSnd = true;
			current_timer_count = 0;
		}
	}
}

/******************************************************************
 * 機能: FW更新情報を取得する時間を計算する
 * 引数: macadr Macアドレス
 * 戻値: fw_check_time FW更新情報の取得時間(オフセット時間[FW_CHECK_PERIOD]からの経過秒数)
 ******************************************************************/
static uint32_t GetFwCheckTime(uint8_t *macadr)
{
	uint32_t cal_macadr = 0;
	uint32_t fw_check_time = 0;

	cal_macadr = ((macadr[4] << 8) + macadr[5]);
	fw_check_time = cal_macadr % FW_CHECK_PERIOD;
	fw_check_time = fw_check_time + FW_CHECK_OFFSET;
	if (check_sec_flg) {
		fw_check_time = (check_sec.tm_hour * 60 * 60) + (check_sec.tm_min * 60) + (check_sec.tm_sec);
	}
	return fw_check_time;
}

/******************************************************************
 * 機能: 現在時刻がFW更新情報を取得する時間か判定する
 * 引数: fw_check_time FW更新情報の取得時間(オフセット時間[FW_CHECK_PERIOD]からの経過秒数)
 * 戻値: 1：更新する／0：更新しない
 ******************************************************************/
static uint8_t IsFwCheck(uint32_t fw_check_time)
{
	int32_t crt_time = 0;
	uint8_t res = 0;
	static int32_t last_fw_check_second = (-FW_NO_CHECKING_VALUE);
	struct tm  localTime;
	// 現在設定されている時刻情報を取得
	Hal_GetLocalTM(&localTime, 0);
	// 00:00:00からの経過秒数を算出
	crt_time = (localTime.tm_hour * 60 * 60) + (localTime.tm_min * 60) + (localTime.tm_sec);
	if (offset_sec_flg) {
		crt_time = (offset_sec.tm_hour * 60 * 60) + (offset_sec.tm_min * 60) + (offset_sec.tm_sec);
	}
	// 最後にFW更新情報のチェックをした時刻からバッファ秒×2より後にチェックしたか(1日で複数回処理防止)
	if (!(crt_time < last_fw_check_second + (FW_CHECK_BUFFER_SECOND * 2)))
	{
		last_fw_check_second = (-FW_NO_CHECKING_VALUE); // 上記IF文が必ずTrueになるような値を設定する。
		// 現在時刻がチェックタイム ± バッファ秒以内か
		if ((crt_time >= (int32_t)(fw_check_time - FW_CHECK_BUFFER_SECOND)) && (crt_time < (int32_t)(fw_check_time + FW_CHECK_BUFFER_SECOND)))
		{
			last_fw_check_second = crt_time;
			res = 1;
		}
	}
	return res;
}

#ifdef DEBUG_FWUP
void disp_GetFwCheckTime(void)
{
	uint8_t	macadr[6] = { 0 };
	uint32_t fw_check_time = 0;
	char tmp[64];
	sysinfo_get_mac_address(macadr);
	fw_check_time = GetFwCheckTime(macadr);
	uint32_t hour = fw_check_time/(60*60);
	uint32_t min = (fw_check_time - (hour*(60*60)))/60;
	uint32_t sec = fw_check_time - (hour*(60*60)) - (min*60);
	snprintf(tmp, sizeof(tmp), "fw_check_time=%d hour=%d min=%d sec=%d", fw_check_time, hour, min, sec);
	DkUdpCmd_SendLog(tmp, LOG_LEVEL_INFO);
}
#endif

/******************************************************************
 * 機能: FW更新情報を取得する時間かどうかチェックする。
 * 引数: none
 * 戻値: none
 ******************************************************************/
void FwUpdateTimeCheck(void)
{
	uint8_t	macadr[6] = { 0 };
	uint32_t fw_check_time = 0;
	if (DkTimeSync_GetTimeSyncState() == TIME_SYNC_STATE_SERVER_SYNC)// 時刻同期が完了している
	{
		sysinfo_get_mac_address(macadr);
		if (fw_macadr_flg) {				// デバッグ用 Macアドレス手動入力
			memcpy(macadr, fw_macadr, sizeof(macadr));
		}
		fw_check_time = GetFwCheckTime(macadr);
		if (IsFwCheck(fw_check_time) == 1)
		{
			/* 定刻到達時アップデートモード判定 */
			E_UPDATE_MODE mode = AppSerial_JudgeUpdateMode(UPDATE_TRIGGER_ARRIVE_TIME);
			if ( (UPDATE_MODE_ARRIVE_FORCE == mode) || (UPDATE_MODE_ARRIVE_AUTO == mode) ) {
				/* 定刻到達時 (強制/自動）アップデートモードの場合は、FWリスト要求を発行 */
				char tmp[64] = {0};
				snprintf (tmp,sizeof(tmp),"%s  Update at arrive time.", (mode == UPDATE_MODE_ARRIVE_FORCE)? "Force" : "Auto");
				DkUdpCmd_SendLog(tmp, LOG_LEVEL_VERBOSE);
				httpc_event_t event = HTTPC_EVENT_FW_CHECK_START;	// 自動アップデート
				if(mode == UPDATE_MODE_ARRIVE_FORCE){
					event = HTTPC_EVENT_FW_CHECK_START_FORCE_ARRIVE; // 強制アップデート
				}
				if (!Httpc_Notify_Event(event) ) {
					DkUdpCmd_SendLog("[Full Queue] FwUpdateTimeCheck",LOG_LEVEL_INFO);
				}
			}
		}
	}
}


/******************************************************************
 * 機能: 自動FWアップデートの実施日を計算する
 * 引数: macadr Macアドレス
 * 戻値: fw_release_date 自動FWアップデートの実施日(自動FWアップデート公開日＋オフセット日数)
 ******************************************************************/
static time_t GetFwReleaseDate(uint8_t *macadr)
{
	uint8_t cal_macadr = 0;
	uint64_t fw_check_date = 0;
	time_t fw_release_date;

	//cal_macadr = macadr[1] << 8 + macadr[0];
	//オフセット日数算出
	cal_macadr =  macadr[4];
	fw_check_date = cal_macadr % httpc_firmware_list.distribution_date;
	fw_check_date = fw_check_date *24 *60 *60; //秒に変換
	//自動FWアップデートの実施日(自動FWアップデート公開日＋オフセット日数)
	fw_release_date = mktime(&httpc_firmware_list.release_time) + (time_t)fw_check_date;

	return fw_release_date;
}

/******************************************************************
 * 機能: 現在日付が自動FWアップデートをする日付か判定する
 * 引数: none
 * 戻値: 1：更新する／0：更新しない
 ******************************************************************/
uint8_t FwUpdateDateCheck(void)
{
	struct tm GmtTime;
	uint8_t	macadr[6] = { 0 };
	uint8_t res = 0;
	char dmsg[100] = { 0 };

	// 現在設定されている時刻情報を取得
	Hal_GetGmtTM(&GmtTime);
	if (offset_datetime_flg) {
		GmtTime = offset_datetime;
	}
	//macアドレス取得
	sysinfo_get_mac_address(macadr);
	if (fw_macadr_flg) {				// デバッグ用 Macアドレス手動入力
		memcpy(macadr, fw_macadr, sizeof(macadr));
	}

	sprintf(dmsg, "fw_gmt_time:%d, local_gmt_time:%d", (int)GetFwReleaseDate(macadr), (int)mktime(&GmtTime));
	DkUdpCmd_SendLog(dmsg, LOG_LEVEL_VERBOSE);

	if(GetFwReleaseDate(macadr) <= mktime(&GmtTime))
	{
		DkUdpCmd_SendLog("IN Update Date", LOG_LEVEL_VERBOSE);
		res = 1;
	}

	return res;
}

/******************************************************************
 * 機能: (デバッグ用) FWチェック時間を設定する。
 * 引数: uint8_t hour, uint8_t min, uint8_t sec, bool set_flag
 * 戻値: 0:設定失敗 1:設定成功
 ******************************************************************/
uint8_t Set_Check_Sec(uint8_t hour, uint8_t min, uint8_t sec, bool set_flag)
{
	uint8_t res = 1;
	if (set_flag) {
		if (0 <= hour && hour < 24) {
			check_sec.tm_hour = hour;
		}
		else {
			res = 0;
		}
		if (0 <= min && min < 60) {
			check_sec.tm_min = min;
		}
		else {
			res = 0;
		}
		if (0 <= sec && sec < 60) {
			check_sec.tm_sec = sec;
		}
		else {
			res = 0;
		}
		if (res == 1) {
			check_sec_flg = true;
		}
	}
	else {
		check_sec_flg = false;
	}
	return res;
}

/******************************************************************
 * 機能: (デバッグ用) オフセット秒を設定する。
 * 引数: uint8_t hour, uint8_t min, uint8_t sec, bool set_flag
 * 戻値: 0:設定失敗 1:設定成功
 ******************************************************************/
uint8_t Set_Offset_Sec(uint8_t hour, uint8_t min, uint8_t sec, bool set_flag)
{
	uint8_t res = 1;
	if (set_flag) {
		if (0 <= hour && hour < 24) {
			offset_sec.tm_hour = hour;
		}else {
			res = 0;
		}
		if (0 <= min && min < 60) {
			offset_sec.tm_min = min;
		}else {
			res = 0;
		}
		if (0 <= sec && sec < 60) {
			offset_sec.tm_sec = sec;
		}else {
			res = 0;
		}
		if (res == 1) {
			offset_sec_flg = true;
		}
	}else {
		offset_sec_flg = false;
		}
	return res;
}

/******************************************************************
 * 機能: (デバッグ用) 現在年月日秒を設定する。
 * 引数: uint32_t year, uint8_t mon, uint8_t day, uint8_t hour, uint8_t min, uint8_t sec, bool set_flag
 * 戻値: 0:設定失敗 1:設定成功
 ******************************************************************/
uint8_t Set_Datetime(uint32_t year, uint8_t mon, uint8_t day, uint8_t hour, uint8_t min, uint8_t sec, bool set_flag)
{
	uint8_t res = 1;
	if (set_flag) {
		if (0 <= year) {
			offset_datetime.tm_year = (year - 1900);
		}
		else {
			res = 0;
		}
		if (0 <= mon && mon < 12) {
			offset_datetime.tm_mon = (mon -1);
		}
		else {
			res = 0;
		}
		if (1 <= day && day < 32) {
			offset_datetime.tm_mday = day;
		}
		else {
			res = 0;
		}
		if (0 <= hour && hour < 24) {
			offset_datetime.tm_hour = hour;
		}
		else {
			res = 0;
		}
		if (0 <= min && min < 60) {
			offset_datetime.tm_min = min;
		}
		else {
			res = 0;
		}
		if (0 <= sec && sec < 60) {
			offset_datetime.tm_sec = sec;
		}
		else {
			res = 0;
		}
		if (res == 1) {
			offset_datetime_flg = true;
		}
	}else {
		offset_datetime_flg = false;
	}
	return res;
}

/******************************************************************
 * 機能: (デバッグ用) FW自動更新時に参照するMacアドレスを設定する。
 * 引数: uint32_t macadr, bool set_flag
 * 戻値: 0:設定失敗 1:設定成功
 ******************************************************************/
uint8_t Set_Macadr(uint8_t mac_0, uint8_t mac_1,uint8_t mac_2, uint8_t mac_3, uint8_t mac_4,uint8_t mac_5, bool set_flag)
{
	uint8_t res = 1;
	if (set_flag) {
		fw_macadr[0] = mac_0;
		fw_macadr[1] = mac_1;
		fw_macadr[2] = mac_2;
		fw_macadr[3] = mac_3;
		fw_macadr[4] = mac_4;
		fw_macadr[5] = mac_5;
		fw_macadr_flg = true;
	}
	else {
		fw_macadr_flg = false;
	}
	return res;
}

static bool IsCompareString(char* json_string, char* const_string)
{
	if (memcmp(json_string, const_string, strlen(const_string)) == 0 )
	{
		return true;
	}
	return false;
}

#ifdef	_DEBUG_JSON_BIGDATADEF
static void JsonDebugPrint(int index, char* string, int value)
{
	char test_msg[128];
	snprintf(test_msg, sizeof(test_msg), "[STB] index(%d) element(%s) value(%d)", index, string, value);
	DkUdpCmd_SendLog(test_msg, LOG_LEVEL_INFO);
}
#define JSON_DEBUG_PRINT(index, value, string)		JsonDebugPrint(index, string, value)
#else
#define JSON_DEBUG_PRINT(index, value, string)
#endif

static int CheckLimitDeviceCycle(int cycle)
{
	if (cycle > 3600)
	{
		cycle = 3600;
	}
	else if(cycle < 20)
	{
		cycle = 20;
	}

	return cycle;
}

static int CheckLimitServerCycle(int cycle)
{
	if (cycle > 60)
	{
		cycle = 60;
	}
	else if(cycle < 1)
	{
		cycle = 1;
	}

	return cycle;
}

bool MakeBigdataDefinition(void)
{
	const int tg_num = get_device_data_cycle_info.tg_num;

	for (int i=0; i<tg_num; i++)
	{
		POLLING_DATA_STORE_INFO_T* info = &get_device_data_cycle_info.data_store_info[i];
		const int co_num = info->get_all_element.array_num;
		char* tg_string = info->tg;

		if(IsCompareString(tg_string, "/dsiot/edge/adr_0100"))
		{
			BIGDATA_DEFINITION_DEVICE_T* device = &bigdata_definition.device;

			for (int j=0; j<co_num; j++)
			{
				char* element = info->get_all_element.element[j];
				const int time_cycle = CheckLimitDeviceCycle( info->store_cycle_time[j] ) / 20;

				if (IsCompareString(element, "*"))
				{
					device->price.timer_cycle = time_cycle;
					device->target.timer_cycle = time_cycle;
					device->scdl_t.timer_cycle = time_cycle;
					device->demand.timer_cycle = time_cycle;
					device->patrol.timer_cycle = time_cycle;
					device->i_power.timer_cycle = time_cycle;

					const int max_dgc_item = bigdata_definition.max_dgc_entity_count;
					BIGDATA_DEFINITION_DGC_T* dgc_item = &bigdata_definition.dgc_status[0];
					for (int dgc_item_index = 0; dgc_item_index < max_dgc_item; dgc_item_index++)
					{
						if (dgc_item->unit_id == DGC_INDOOR_UNIT_ADDR)
						{
							dgc_item->timer_cycle = time_cycle;
						}
						dgc_item++;
					}

					JSON_DEBUG_PRINT(j,time_cycle, "* [dgc_status, price, target, scdl_t, demand, patrol, i_power]");
				}
				else if (IsCompareString(element, "dgc_status.*"))
				{
					const int max_dgc_item = bigdata_definition.max_dgc_entity_count;
					BIGDATA_DEFINITION_DGC_T* dgc_item = &bigdata_definition.dgc_status[0];
					for (int dgc_item_index = 0; dgc_item_index < max_dgc_item; dgc_item_index++)
					{
						if (dgc_item->unit_id == DGC_INDOOR_UNIT_ADDR)
						{
							dgc_item->timer_cycle = time_cycle;
						}
						dgc_item++;
					}

					JSON_DEBUG_PRINT(j,time_cycle, "* [dgc_status]");
				}
				else if( memcmp(element, "dgc_status.", strlen("dgc_status.")) == 0 )
				{
					char* unit_string = (char*)&element[11];
					const bool header_ok = ( memcmp(unit_string, "e_1002.e_", strlen("e_1002.e_")) == 0 );

					if (header_ok == true)
					{
						char* entity_string = (char*)&element[20];
						const int entity_id = strtol( entity_string, NULL, 16 );

						const int max_dgc_item = bigdata_definition.max_dgc_entity_count;
						BIGDATA_DEFINITION_DGC_T* dgc_item = &bigdata_definition.dgc_status[0];
						for (int dgc_item_index = 0; dgc_item_index < max_dgc_item; dgc_item_index++)
						{
							if (dgc_item->unit_id == DGC_INDOOR_UNIT_ADDR)
							{
								if ( dgc_item->entity_id == entity_id)
								{
									dgc_item->timer_cycle = time_cycle;
									JSON_DEBUG_PRINT(j,time_cycle, element);
								}
							}
							dgc_item++;
						}
					}
				}
				else if (IsCompareString(element, "price"))
				{
					device->price.timer_cycle = time_cycle;
					JSON_DEBUG_PRINT(j,time_cycle, element);
				}
				else if (IsCompareString(element, "target"))
				{
					device->target.timer_cycle = time_cycle;
					JSON_DEBUG_PRINT(j,time_cycle, element);
				}
				else if (IsCompareString(element, "scdl_t"))
				{
					device->scdl_t.timer_cycle = time_cycle;
					JSON_DEBUG_PRINT(j,time_cycle, element);
				}
				else if (IsCompareString(element, "demand"))
				{
					device->demand.timer_cycle = time_cycle;
					JSON_DEBUG_PRINT(j,time_cycle, element);
				}
				else if (IsCompareString(element, "patrol"))
				{
					device->patrol.timer_cycle = time_cycle;
					JSON_DEBUG_PRINT(j,time_cycle, element);
				}
				else if (IsCompareString(element, "i_power"))
				{
					device->i_power.timer_cycle = time_cycle;
					JSON_DEBUG_PRINT(j,time_cycle, element);
				}
				else
				{
					JSON_DEBUG_PRINT(j,time_cycle, "0100_unknown-element");
				}
			}
		}
		else if(IsCompareString(tg_string, "/dsiot/edge/adr_0200"))
		{
			for (int j=0; j<co_num; j++)
			{
				char* element = info->get_all_element.element[j];
				const int time_cycle = CheckLimitDeviceCycle( info->store_cycle_time[j] ) / 20;

				if (IsCompareString(element, "*"))
				{
					const int max_dgc_item = bigdata_definition.max_dgc_entity_count;
					BIGDATA_DEFINITION_DGC_T* dgc_item = &bigdata_definition.dgc_status[0];
					for (int dgc_item_index = 0; dgc_item_index < max_dgc_item; dgc_item_index++)
					{
						if (dgc_item->unit_id == DGC_OUTDOOR_UNIT_ADDR)
						{
							dgc_item->timer_cycle = time_cycle;
						}
						dgc_item++;
					}

					JSON_DEBUG_PRINT(j,time_cycle, "* [0200_dgc_status]");
				}
				else if (IsCompareString(element, "dgc_status.*"))
				{
					const int max_dgc_item = bigdata_definition.max_dgc_entity_count;
					BIGDATA_DEFINITION_DGC_T* dgc_item = &bigdata_definition.dgc_status[0];
					for (int dgc_item_index = 0; dgc_item_index < max_dgc_item; dgc_item_index++)
					{
						if (dgc_item->unit_id == DGC_OUTDOOR_UNIT_ADDR)
						{
							dgc_item->timer_cycle = time_cycle;
						}
						dgc_item++;
					}

					JSON_DEBUG_PRINT(j,time_cycle, "* [0200_dgc_status]");
				}
				else if( memcmp(element, "dgc_status.", strlen("dgc_status.")) == 0 )
				{
					char* unit_string = (char*)&element[11];
					const bool header_ok = ( memcmp(unit_string, "e_1003.e_", strlen("e_1003.e_")) == 0 );

					if (header_ok == true)
					{
						char* entity_string = (char*)&element[20];
						const int entity_id = strtol( entity_string, NULL, 16 );

						const int max_dgc_item = bigdata_definition.max_dgc_entity_count;
						BIGDATA_DEFINITION_DGC_T* dgc_item = &bigdata_definition.dgc_status[0];
						for (int dgc_item_index = 0; dgc_item_index < max_dgc_item; dgc_item_index++)
						{
							if (dgc_item->unit_id == DGC_OUTDOOR_UNIT_ADDR)
							{
								if ( dgc_item->entity_id == entity_id)
								{
									dgc_item->timer_cycle = time_cycle;
									JSON_DEBUG_PRINT(j,time_cycle, element);
									break;
								}
							}
							dgc_item++;
						}
					}
				}
				else
				{
					JSON_DEBUG_PRINT(j,time_cycle, "0200_unknown-element");
				}
			}
		}
		else if (IsCompareString(tg_string, "/dsiot/edge"))
		{
			BIGDATA_DEFINITION_EDGE_T* edge = &bigdata_definition.edge;

			for (int j=0; j<co_num; j++)
			{
				char* element = info->get_all_element.element[j];
				const int time_cycle = CheckLimitDeviceCycle( info->store_cycle_time[j] ) / 20;

				if (IsCompareString(element, "*"))
				{
					edge->adp_i.timer_cycle = time_cycle;
					edge->adp_d.timer_cycle = time_cycle;
					edge->dev_i.timer_cycle = time_cycle;
					edge->adp_r.timer_cycle = time_cycle;
					edge->adp_f.timer_cycle = time_cycle;

					JSON_DEBUG_PRINT(j,time_cycle, "* [adp_i, adp_d, dev_i, adp_r, adp_f]");
				}
				else if (IsCompareString(element, "adp_i"))
				{
					edge->adp_i.timer_cycle = time_cycle;
					JSON_DEBUG_PRINT(j,time_cycle, element);
				}
				else if (IsCompareString(element, "adp_d"))
				{
					edge->adp_d.timer_cycle = time_cycle;
					JSON_DEBUG_PRINT(j,time_cycle, element);
				}
				else if (IsCompareString(element, "dev_i"))
				{
					edge->dev_i.timer_cycle = time_cycle;
					JSON_DEBUG_PRINT(j,time_cycle, element);
				}
				else if (IsCompareString(element, "adp_r"))
				{
					edge->adp_r.timer_cycle = time_cycle;
					JSON_DEBUG_PRINT(j,time_cycle, element);
				}
				else if (IsCompareString(element, "adp_f"))
				{
					edge->adp_f.timer_cycle = time_cycle;
					JSON_DEBUG_PRINT(j,time_cycle, element);
				}
				else
				{
					JSON_DEBUG_PRINT(j,time_cycle, "edge_resource unknown-element");
				}
			}
		}

		info++;
	}

	const int server_timer_cycle = CheckLimitServerCycle( get_device_data_cycle_info.send_srv_time );
	// 単位変換 send_srv_time = 1分単位 -> server_timer_cycle = 20秒単位
	bigdata_definition.server_timer_cycle = (server_timer_cycle * (60 / 20));

	bigdata_definition.receive_defined_data = true;
	return true;
}

#if 0
static char* PrintGetOrNone(bool get_data)
{
	return (get_data == true) ? "Get!" : "----";
}

void BigDataDefinitionPrintAll(void)
{
	char debug_msg[128];
	DkUdpCmd_SendLog("", LOG_LEVEL_INFO);
	DkUdpCmd_SendLog("***** BIGDATA_PRINT_START *****", LOG_LEVEL_INFO);

	DkUdpCmd_SendLog("", LOG_LEVEL_INFO);
	DkUdpCmd_SendLog("  DGC_STATUS", LOG_LEVEL_INFO);
	BIGDATA_DEFINITION_DGC_T* dgc = &bigdata_definition.dgc_status[0];
	for(int i=0; i<bigdata_definition.max_dgc_entity_count; i++)
	{
		snprintf(debug_msg, sizeof(debug_msg), "  index(%d) unit(0x%04X) entity(0x%04X) cycle(%d)  %s", i, dgc->unit_id, dgc->entity_id, dgc->timer_cycle, PrintGetOrNone(dgc->get_data));
		DkUdpCmd_SendLog(debug_msg, LOG_LEVEL_INFO);
		dgc++;
	}

	DkUdpCmd_SendLog("", LOG_LEVEL_INFO);
	DkUdpCmd_SendLog("  EDGE", LOG_LEVEL_INFO);
	BIGDATA_DEFINITION_EDGE_T* edge = &bigdata_definition.edge;
	{
		snprintf(debug_msg, sizeof(debug_msg), "  adp_i(%d) %s", edge->adp_i.timer_cycle, PrintGetOrNone(edge->adp_i.get_data));DkUdpCmd_SendLog(debug_msg, LOG_LEVEL_INFO);
		snprintf(debug_msg, sizeof(debug_msg), "  adp_d(%d) %s", edge->adp_d.timer_cycle, PrintGetOrNone(edge->adp_d.get_data));DkUdpCmd_SendLog(debug_msg, LOG_LEVEL_INFO);
		snprintf(debug_msg, sizeof(debug_msg), "  dev_i(%d) %s", edge->dev_i.timer_cycle, PrintGetOrNone(edge->dev_i.get_data));DkUdpCmd_SendLog(debug_msg, LOG_LEVEL_INFO);
		snprintf(debug_msg, sizeof(debug_msg), "  adp_r(%d) %s", edge->adp_r.timer_cycle, PrintGetOrNone(edge->adp_r.get_data));DkUdpCmd_SendLog(debug_msg, LOG_LEVEL_INFO);
		snprintf(debug_msg, sizeof(debug_msg), "  adp_f(%d) %s", edge->adp_f.timer_cycle, PrintGetOrNone(edge->adp_f.get_data));DkUdpCmd_SendLog(debug_msg, LOG_LEVEL_INFO);
	}

	DkUdpCmd_SendLog("", LOG_LEVEL_INFO);
	DkUdpCmd_SendLog("  DEVICE", LOG_LEVEL_INFO);
	BIGDATA_DEFINITION_DEVICE_T* device = &bigdata_definition.device;
	{
		snprintf(debug_msg, sizeof(debug_msg), "  price(%d) %s", device->price.timer_cycle, PrintGetOrNone(device->price.get_data));DkUdpCmd_SendLog(debug_msg, LOG_LEVEL_INFO);
		snprintf(debug_msg, sizeof(debug_msg), "  target(%d) %s", device->target.timer_cycle, PrintGetOrNone(device->target.get_data));DkUdpCmd_SendLog(debug_msg, LOG_LEVEL_INFO);
		snprintf(debug_msg, sizeof(debug_msg), "  scdl_t(%d) %s", device->scdl_t.timer_cycle, PrintGetOrNone(device->scdl_t.get_data));DkUdpCmd_SendLog(debug_msg, LOG_LEVEL_INFO);
		snprintf(debug_msg, sizeof(debug_msg), "  demand(%d) %s", device->demand.timer_cycle, PrintGetOrNone(device->demand.get_data));DkUdpCmd_SendLog(debug_msg, LOG_LEVEL_INFO);
		snprintf(debug_msg, sizeof(debug_msg), "  patrol(%d) %s", device->patrol.timer_cycle, PrintGetOrNone(device->patrol.get_data));DkUdpCmd_SendLog(debug_msg, LOG_LEVEL_INFO);
		snprintf(debug_msg, sizeof(debug_msg), "  i_power(%d) %s", device->i_power.timer_cycle, PrintGetOrNone(device->i_power.get_data));DkUdpCmd_SendLog(debug_msg, LOG_LEVEL_INFO);
	}

	DkUdpCmd_SendLog("***** BIGDATA_PRINT_END *****", LOG_LEVEL_INFO);
	DkUdpCmd_SendLog("", LOG_LEVEL_INFO);
}
#endif
